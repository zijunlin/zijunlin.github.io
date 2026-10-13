import { waitForCanvasColor } from '../helpers/game-scenario.js';
import { canvasColorPixels } from '../helpers/game-canvas.js';
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
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (...args) { return this.id === 'shader-canvas' ? null : getContext.apply(this, args); };
      });
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
      await page.keyboard.press('p');
      const frozen = await page.locator('.game-effects').evaluate(canvas => canvas.toDataURL());
      await page.clock.runFor(3000);
      expect(await page.locator('.game-effects').evaluate(canvas => canvas.toDataURL())).toBe(frozen);
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
