import { observeGameDrawing, expectSatellites } from '../helpers/game-drawing.js';
import { test, expect } from '@playwright/test';
import { entranceCenters, trailContrast, trajectorySample } from '../helpers/trail-pixels.js';
import { imageDifference } from '../helpers/image-difference.mjs';
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(observeGameDrawing);
  const time = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
});
async function enter(page, captureTrail = false) {
  await page.goto('/?seed=0');
  await expect(page.locator('#world-entry')).toBeVisible();
  await expect(page.locator('#world-entry')).toHaveCSS('opacity', '1');
  let probe;
  if (captureTrail) {
    await page.clock.runFor(6000);
    const history = [await entranceCenters(page)];
    for (let i = 0; i < 2; i++) { await page.clock.runFor(1000); history.push(await entranceCenters(page)); }
    await page.clock.runFor(1000);
    probe = trajectorySample(history, 1, 0);
    expect(trailContrast(await page.screenshot(), probe.point, probe.tangent, page.viewportSize())).toBeGreaterThan(3);
    await page.clock.runFor(1100);
  } else await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toHaveCount(0);
  await expect(page.locator('.space-game')).toBeFocused();
  return probe;
}
test('opening retains the world and navigation, then restores original entrances', async ({ page }, info) => {
  const probe = await enter(page, true);
  const pausedCenters = await entranceCenters(page);
  const original = await page.locator('.celestial-gate').first().elementHandle();
  await page.clock.runFor(3100);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await expectSatellites(page);
  const playing = await page.screenshot({ path: info.outputPath('opening-ready.png') });
  expect(trailContrast(playing, probe.point, probe.tangent, page.viewportSize())).toBeLessThan(2);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(350);
  await expect(page.locator('.space-game')).toHaveCount(1);
  expect(await entranceCenters(page)).toEqual(pausedCenters);
  expect(trailContrast(await page.screenshot(), probe.point, probe.tangent, page.viewportSize())).toBeLessThan(2);
  expect(await page.evaluate(() => window.gameDrawing.ship.opacity)).toBeLessThan(.8);
  await page.clock.runFor(1400);
  const restored = await page.screenshot({ path: info.outputPath('restored-trail.png') });
  expect(trailContrast(restored, probe.point, probe.tangent, page.viewportSize())).toBeGreaterThan(3);
  // Returning restores the orbit, then it continues instead of being frozen
  // indefinitely by the programmatically restored entrance focus.
  const resumed = await entranceCenters(page);
  expect(Math.hypot(resumed[0].x - pausedCenters[0].x, resumed[0].y - pausedCenters[0].y)).toBeLessThan(4);
  await page.clock.runFor(250);
  const later = await entranceCenters(page);
  expect(Math.hypot(later[0].x - resumed[0].x, later[0].y - resumed[0].y)).toBeGreaterThan(.5);
  expect(await original.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('#about-panel-title')).toBeFocused();
});
test('resize pauses opening and only a manual resume advances it', async ({ page }) => {
  await enter(page);
  await page.clock.runFor(500);
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await page.clock.runFor(5000);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(2600);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(1700);
  await expect(page.locator('.space-game')).toHaveCount(0);
});
test('top navigation exits an active opening without stealing content focus', async ({ page }) => {
  await enter(page);
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('#about-panel-title')).toBeFocused();
  await expect(page).toHaveURL(/#about$/);
});
test('hidden opening stays paused until confirmation', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(6000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(3100);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
});
test('reduced motion still reaches the same playable formation', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await page.clock.runFor(3100);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('opening-reduced.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(1700);
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
});

test('navigation interrupts a return without a late focus change', async ({ page }) => {
  const probe = await enter(page, true);
  await page.clock.runFor(3100);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(350);
  await expectSatellites(page);
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('#about-panel-title')).toBeFocused();
  await page.clock.runFor(3000);
  await expect(page).toHaveURL(/#about$/);
  await expect(page.locator('#about-panel-title')).toBeFocused();
  await expect(page.locator('.space-game, .game-effects')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(trailContrast(await page.screenshot(), probe.point, probe.tangent, page.viewportSize())).toBeGreaterThan(3);
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
});

test('resizing during return keeps the final orb positions and sizes continuous', async ({ page }) => {
  await enter(page);
  await page.clock.runFor(3100);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(350);
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toHaveCount(0);
  await page.mouse.move(0, 0);
  const boxes = await page.locator('.celestial-gate').all();
  const clips = await Promise.all(boxes.map(async link => {
    const box = await link.boundingBox();
    return { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) };
  }));
  await page.clock.runFor(1138);
  await expectSatellites(page);
  const returning = [];
  for (const clip of clips) returning.push(await page.screenshot({ clip }));
  await page.clock.runFor(32);
  await expect(page.locator('.space-game')).toHaveCount(0);
  for (let i = 0; i < clips.length; i++) {
    expect(imageDifference(returning[i], await page.screenshot({ clip: clips[i] })),
      `orb ${i} meets its resized home position and size continuously`).toBeLessThan(1);
  }
});

test('opening pause retains its return action and resumes focus on the game', async ({ page }) => {
  await enter(page);
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(page.locator('.space-game')).toBeFocused();
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toHaveCount(0);
  await page.keyboard.press('p');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(1700);
  await expect(page.locator('.space-game')).toHaveCount(0);
});
