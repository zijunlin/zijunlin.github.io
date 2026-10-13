import { greenResourcePixels, forwardFanLanes } from '../helpers/game-canvas.js';
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const evidence = process.env.GAME_EVIDENCE_DIR;
if (evidence) mkdirSync(evidence, { recursive: true });
test.use({ reducedMotion: 'reduce' });
test.setTimeout(150000);
test('resource diamonds become a visible triple-shot upgrade and replay resets it', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    Math.random = () => .5;
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) { return this.id === 'shader-canvas' ? null : context.apply(this, args); };
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await expect(page.locator('.game-pickup')).toHaveText('');
  // With the arena extended to the navigation, approach the first drop before the second arrives.
  await page.clock.runFor(5000);
  const greenPixels = await greenResourcePixels(page);
  expect(greenPixels).toBeGreaterThan(10);
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(2200); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.game-pickup')).toContainText('飞船弹道数 +1 · 当前 3 条');
  await page.keyboard.down('ArrowDown'); await page.clock.runFor(700); await page.keyboard.up('ArrowDown');
  await page.clock.runFor(180);
  const fan = await forwardFanLanes(page);
  expect(fan).toEqual(['center', 'left', 'right']);
  await page.clock.runFor(1200);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.game-pickup')).toHaveText('');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(page.locator('.game-pickup')).toHaveText('');
});
for (const motion of ['reduce', 'no-preference']) {
test.describe(motion, () => {
test.use({ reducedMotion: motion });
test('orange ring drops refill the visible shockwave reserve', async ({ page }) => {
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    Math.random = () => .5;
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) { return this.id === 'shader-canvas' ? null : context.apply(this, args); };
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront(); await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  // Wait until the real twelfth target is destroyed; the paused clock removes wall-time drift.
  await page.clock.runFor(12000);
  const orangePixels = await page.locator('.game-effects').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === 255 && data[i + 1] === 187 && data[i + 2] === 102) count++;
    return count;
  });
  expect(orangePixels).toBeGreaterThan(10);
  if (evidence) await page.screenshot({ path: `${evidence}/${motion}-orange-resource.png` });
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(2200); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.game-shockwave')).toContainText('2 / 3');
});

});
}
