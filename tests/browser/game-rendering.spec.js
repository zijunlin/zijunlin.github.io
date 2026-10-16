import { observeGameDrawing, expectSatellites } from '../helpers/game-drawing.js';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { imageDifference } from '../helpers/image-difference.mjs';

// Compare real rendered color in concentric regions across renderer ownership.
// The native adapters retain the same numerical appearance across ownership.
function radialColors(screenshot) {
  const png = PNG.sync.read(screenshot);
  return [[0, .175], [.2, .35], [.35, .48]].map(([inner, outer]) => {
    const channels = [0, 0, 0]; let count = 0;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      const radius = Math.hypot(x - png.width / 2, y - png.height / 2) / png.width;
      if (radius < inner || radius > outer) continue;
      count++;
      for (let channel = 0; channel < 3; channel++) channels[channel] += png.data[(y * png.width + x) * 4 + channel];
    }
    return channels.map(value => value / count);
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(observeGameDrawing);
  const time = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0');
  await expect(page.locator('#world-entry')).toBeVisible();
  await expect(page.locator('#world-entry')).toHaveCSS('opacity', '1');
});

for (const hovered of [false, true]) {
  test(`opening preserves the captured orb appearance with hover ${hovered}`, async ({ page }, info) => {
    await page.clock.runFor(1200);
    const orb = page.locator('.celestial-gate').first();
    if (hovered) { await orb.hover(); await page.clock.runFor(800); }
    const box = await orb.boundingBox();
    const size = box.width * (hovered ? .4935 : .378);
    const clip = { x: Math.floor(box.x + (box.width - size) / 2), y: Math.floor(box.y + (box.height - size) / 2), width: Math.ceil(size), height: Math.ceil(size) };
    const before = await page.screenshot({ clip, path: info.outputPath('before.png') });
    await page.keyboard.press('Shift+G');
    await expectSatellites(page);
    await page.clock.runFor(16); // The first game frame has dt=0; the shared surface releases its home image.
    const captured = await page.screenshot({ clip, path: info.outputPath('captured.png') });
    await info.attach('before-handoff', { body: before, contentType: 'image/png' });
    await info.attach('captured-handoff', { body: captured, contentType: 'image/png' });
    const beforeColors = radialColors(before), capturedColors = radialColors(captured);
    for (let region = 0; region < beforeColors.length; region++) for (let channel = 0; channel < 3; channel++) {
      expect(Math.abs(beforeColors[region][channel] - capturedColors[region][channel]), `rendered region ${region} channel ${channel}`).toBeLessThan(2);
    }
    expect(imageDifference(before, captured), 'native home and game artwork must meet without missing or duplicate orbs').toBeLessThan(3);
    await info.attach('appearance-colors', { body: JSON.stringify({ beforeColors, capturedColors }), contentType: 'application/json' });

  });
}

test('unchanged shockwave information is not rebuilt every frame', async ({ page }) => {
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3300);
  await page.locator('.game-shockwave').evaluate(el => {
    window.waveUpdates = 0;
    new MutationObserver(records => { window.waveUpdates += records.length; }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.waveUpdates)).toBe(0);
  await page.keyboard.press('Space');
  await page.clock.runFor(32);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
  expect(await page.evaluate(() => window.waveUpdates)).toBe(1);
});

test('a hovered orb returns without a size flash after the viewport changes', async ({ page, browserName }, info) => {
  await page.clock.runFor(1200);
  const entrance = page.locator('.celestial-gate').first();
  await entrance.hover();
  await page.clock.runFor(750);
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3300);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(350);
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.mouse.move(0, 0);
  const box = await entrance.boundingBox();
  const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) };
  await page.clock.runFor(1138);
  await expectSatellites(page);
  // Returning restores semantic focus. WebKit paints that outline immediately;
  // compare the orb separately from the newly visible keyboard affordance.
  const artworkOnly = '.celestial-gate { outline: none !important; }';
  const returning = await page.screenshot({ clip, style: artworkOnly, path: info.outputPath('returning.png') });
  await page.clock.runFor(32);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(entrance).toBeFocused();
  const restored = await page.screenshot({ clip, style: artworkOnly, path: info.outputPath('restored.png') });
  expect(imageDifference(returning, restored), 'the visible orb must join its resized home position continuously').toBeLessThan(1);
  if (browserName === 'webkit') {
    await expect(entrance).toHaveCSS('outline-style', 'solid');
    await expect(entrance).toHaveCSS('outline-width', '1px');
    await expect(entrance.locator('.orb-caption')).toBeVisible();
  }
});

test('switching to reduced motion settles keyboard focus feedback immediately', async ({ page }, info) => {
  const entrance = page.locator('.celestial-gate').first();
  await entrance.focus();
  await expect(entrance.locator('.orb-caption')).toBeVisible();
  await page.clock.runFor(100);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.runFor(16);
  const box = await entrance.boundingBox();
  const clip = { x: Math.floor(box.x + box.width / 2 - 50), y: Math.floor(box.y + box.height / 2 - 50), width: 100, height: 100 };
  const settled = await page.screenshot({ clip, path: info.outputPath('reduced-focus.png') });
  await page.clock.runFor(300);
  const later = await page.screenshot({ clip, path: info.outputPath('reduced-focus-later.png') });
  expect(imageDifference(settled, later), 'focus artwork must stop transitioning under reduced motion').toBeLessThan(1);
  // Use the same real focus boundary as the cross-engine home checks. Native
  // Tab traversal can skip links under WebKit's platform keyboard preference.
  await page.locator('.celestial-gate').nth(1).focus();
  await entrance.focus();
  await expect(entrance).toBeFocused();
  await expect(entrance).toHaveCSS('outline-style', 'solid');
  await page.clock.runFor(16);
  const refocused = await page.screenshot({ clip, path: info.outputPath('reduced-refocused.png') });
  expect(imageDifference(settled, refocused), 'an existing focus settles to the same appearance as a fresh reduced-motion focus').toBeLessThan(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#about$/);
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
});


test('shared surface displays the ship and cockpit while battle effects keep their own canvas', async ({ page }, info) => {
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3300);
  const isolated = await page.addStyleTag({ content: '.game-visuals { visibility: hidden; }' });
  const rendered = PNG.sync.read(await page.locator('#shader-canvas').screenshot({ path: info.outputPath('native-ship.png') }));
  let cockpit = 0;
  for (let y = 740; y < 760; y++) for (let x = 630; x < 650; x++) {
    const at = (y * rendered.width + x) * 4;
    if (rendered.data[at] > 220 && rendered.data[at + 1] > 248 && rendered.data[at + 2] > 248) cockpit++;
  }
  expect(cockpit, 'visible cockpit must be drawn in the shared graphics surface').toBeGreaterThan(3);
  await isolated.evaluate(node => node.remove());
  await expect(page.locator('.game-effects')).toBeAttached();
});

test('a real shockwave stays behind the opaque ship silhouette', async ({ page }, info) => {
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3300);
  const before = PNG.sync.read(await page.screenshot({ path: info.outputPath('before-shockwave.png') }));
  await page.keyboard.press('Space');
  let intersections = [];
  for (let frame = 0; frame < 3 && intersections.length < 5; frame++) {
    await page.clock.runFor(16);
    const wave = await page.locator('.game-effects').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, pixels = [];
      for (let i = 0; i < data.length; i += 4) if (data[i] === 155 && data[i + 1] === 232 && data[i + 2] === 255 && data[i + 3] > 240) pixels.push(i);
      return pixels;
    });
    intersections = wave.filter(i => Math.abs(before.data[i] - 167) < 2 && Math.abs(before.data[i + 1] - 233) < 2 && Math.abs(before.data[i + 2] - 237) < 2);
  }
  expect(intersections.length, 'real Canvas2D shockwave intersects at least five opaque hull pixels').toBeGreaterThanOrEqual(5);
  const after = PNG.sync.read(await page.screenshot({ path: info.outputPath('overlapping-shockwave.png') }));
  const difference = intersections.reduce((sum, at) => sum + [0, 1, 2].reduce((n, c) => n + Math.abs(after.data[at + c] - before.data[at + c]), 0), 0) / (intersections.length * 3);
  expect(difference, 'the existing opaque hull still covers the wave at every overlapping pixel').toBeLessThan(2);
});
