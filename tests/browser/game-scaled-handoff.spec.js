import { test, expect } from '@playwright/test';
import { observeGameDrawing } from '../helpers/game-drawing.js';
import { imageDifference } from '../helpers/image-difference.mjs';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
test('a small-screen pressed orb hands off its nonzero viewport offset without a jump', async ({ page }, info) => {
  await page.addInitScript(observeGameDrawing);
  const time = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0'); await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(1200);
  const link = page.locator('.celestial-gate').first();
  await link.hover(); await page.clock.runFor(800);
  const box = await link.boundingBox(), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.down(); await page.clock.runFor(32);
  // Cancel native navigation through the real drag gesture while retaining the
  // short press animation at this paused clock phase.
  await page.mouse.move(center.x + 12, center.y); await page.clock.runFor(16); await page.mouse.up();
  const current = await link.boundingBox(); center.x = current.x + current.width / 2; center.y = current.y + current.height / 2;
  const nearest = () => page.evaluate(center => window.gameDrawing.orbs.reduce((best, orb) =>
    Math.hypot(orb.x - center.x, orb.y - center.y) < Math.hypot(best.x - center.x, best.y - center.y) ? orb : best), center);
  const beforePosition = await nearest();
  expect(Math.abs(beforePosition.x - center.x)).toBeGreaterThan(.5);
  const clip = { x: Math.floor(center.x - 25), y: Math.floor(center.y - 25), width: 50, height: 50 };
  const before = await page.screenshot({ clip, path: info.outputPath('pressed-home.png') });
  await page.keyboard.press('Shift+G'); await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(16);
  const afterPosition = await nearest();
  const after = await page.screenshot({ clip, path: info.outputPath('pressed-game.png') });
  expect(Math.abs(afterPosition.x - beforePosition.x)).toBeLessThan(.02);
  expect(Math.abs(afterPosition.y - beforePosition.y)).toBeLessThan(.02);
  expect(imageDifference(before, after), 'actual disc edge and pressed halo stay at the same visible pixels').toBeLessThan(.3);
});
