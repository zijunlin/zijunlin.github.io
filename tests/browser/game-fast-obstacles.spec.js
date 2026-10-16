import { productionGameBundle, observeProductionBattle } from '../helpers/game-performance.js';
import { waitForCanvasColor } from '../helpers/game-scenario.js';
import { canvasColorPixels, sharedImage, colorPixels } from '../helpers/game-canvas.js';
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const evidence = process.env.GAME_EVIDENCE_DIR;
if (evidence) mkdirSync(evidence, { recursive: true });
for (const motion of ['reduce', 'no-preference']) {
  test.describe(motion, () => {
    test.use({ reducedMotion: motion });
    test('fast obstacles retain a bright silhouette during pause and reset on replay', async ({ page }) => {
      test.setTimeout(150000);
      await page.addInitScript(() => {
        Math.random = () => .1;
      });
      await page.route(productionGameBundle, async route => { const response = await route.fetch(); await route.fulfill({ response, body: observeProductionBattle(await response.text()).replace('...options, random', '...options') }); });
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
      await page.goto('/'); await page.bringToFront();
      await expect(page.locator('#world-entry')).toBeVisible();
      await page.clock.runFor(10100);
      await expect(page.getByText('正在集结')).toBeVisible();
      await page.clock.runFor(3200);
      await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
      const brightPixels = () => canvasColorPixels(page, [255, 240, 122]);
      expect(await brightPixels()).toBe(0);
      await waitForCanvasColor(page, [255, 240, 122], { timeout: 14000, step: 200 });
      if (evidence) await page.screenshot({ path: `${evidence}/${motion}-fast-obstacles.png` });
      const warning = await sharedImage(page);
      expect(colorPixels(warning, [255,240,122], { x: 0, y: 80, width: 35, height: 170 }), 'fast warning is visible at the left arena edge').toBeGreaterThan(10);
      await page.clock.runFor(1700);
      const fast = await page.evaluate(() => window.battleSnapshot.obstacles.find(value => value.fast && value.warning === 0));
      expect(fast).toBeTruthy();
      const wake = await sharedImage(page), speed = Math.hypot(fast.vx, fast.vy), dx = fast.vx / speed, dy = fast.vy / speed;
      if (evidence) await page.screenshot({ path: `${evidence}/${motion}-fast-double-wake.png` });
      for (const side of [-1, 1]) {
        let pixels = 0;
        for (let y = Math.floor(fast.y-40); y < fast.y+40; y++) for (let x = Math.floor(fast.x-40); x < fast.x+40; x++) {
          const rx = x+.5-fast.x, ry = y+.5-fast.y;
          const behind = -(rx*dx+ry*dy), across = -rx*dy+ry*dx;
          // Observe the exposed rear part only: the contour cannot satisfy it,
          // and the two narrow parallel strips cannot satisfy one another.
          if (behind <= fast.radius+2 || behind >= fast.radius*.6+18 || Math.abs(across-side*fast.radius*.45) > 1.5) continue;
          pixels += colorPixels(wake, [255,240,122], { x, y, width: 1, height: 1 });
        }
        expect(pixels, `visible wake on side ${side}`).toBeGreaterThan(2);
      }
      await page.keyboard.press('p');
      const yellowMask = async () => { const image = await sharedImage(page); return [...image.data.keys()].filter(i => i % 4 === 0 && [255, 240, 122].every((v, c) => Math.abs(image.data[i + c] - v) <= 6)); };
      const frozen = await yellowMask();
      await page.clock.runFor(3000);
      expect(await yellowMask()).toEqual(frozen);
      await page.getByRole('button', { name: '继续游戏', exact: true }).click();
      await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowUp');
      await page.clock.runFor(1300);
      await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
      await page.keyboard.down('Space'); await page.clock.runFor(500); await page.keyboard.up('Space');
      await expect(page.locator('.game-score')).not.toContainText('分数: 0');
      if (evidence) await page.screenshot({ path: `${evidence}/${motion}-fast-wave.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '再来一局', exact: true }).click();
      await page.clock.runFor(100);
      expect(await brightPixels()).toBe(0);
    });
  });
}
