import { observeGameDrawing, drawnShipBox, shipScreenshot } from '../helpers/game-drawing.js';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

test.use({ deviceScaleFactor: 3 });
test.setTimeout(150000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(observeGameDrawing);
  await page.addInitScript(() => {
    Math.random = () => .5;
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
});
async function enter(page) {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.keyboard.press('Shift+G');
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
}
// Read the rendered hull, independently of CSS transforms or runtime state.
async function wings(page, testInfo, name) {
  const screenshot = await shipScreenshot(page, { path: testInfo.outputPath(name + '.png') });
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  const png = PNG.sync.read(screenshot), pixels = [], cockpit = [];
  const coverageScale = await page.evaluate(() => devicePixelRatio / (document.querySelector('#shader-canvas').width / innerWidth));
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4;
    if (png.data[i] > 220 && png.data[i + 1] > 248 && png.data[i + 2] > 248) cockpit.push({ x, y });
    // Read the solid hull, excluding antialiased edge pixels mixed with its glow.
    if (Math.abs(png.data[i] - 167) < 8 && Math.abs(png.data[i + 1] - 233) < 8 && Math.abs(png.data[i + 2] - 237) < 8) pixels.push({ x, y });
  }
  expect(pixels.length).toBeGreaterThan(25);
  const left = Math.min(...pixels.map(p => p.x)), right = Math.max(...pixels.map(p => p.x));
  const top = Math.min(...pixels.map(p => p.y));
  const nose = pixels.filter(p => p.y <= top + 1);
  const meanX = points => points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const axisOffset = (meanX(nose) - meanX(cockpit)) / coverageScale;
  expect(Math.abs(axisOffset)).toBeLessThan(1.5);
  // Compare actual wing-tip heights. Averaging the outermost two columns
  // weights different lengths of the sloping edge at fractional pixel offsets.
  const wingWidth = (right - left) / 4;
  const tip = points => Math.max(...points.map(p => p.y));
  // Express edge coverage in actual surface pixels. At the total pixel budget,
  // screenshots upscale the surface, so one edge pixel spans >1 screenshot px.
  return { drop: (tip(pixels.filter(p => p.x >= right - wingWidth)) - tip(pixels.filter(p => p.x <= left + wingWidth))) / coverageScale,
    width: (right - left) / coverageScale, height: (Math.max(...pixels.map(p => p.y)) - top) / coverageScale };
}
function upright(sample, reference) {
  expect(Math.abs(sample.drop)).toBeLessThan(1.5);
  expect(Math.abs(sample.width - reference.width)).toBeLessThan(2);
  expect(Math.abs(sample.height - reference.height)).toBeLessThan(2);
}

test('replaying after horizontal movement preserves the upright ship', async ({ page }, testInfo) => {
  await enter(page);
  const level = await wings(page, testInfo, 'initial-level');
  const before = await drawnShipBox(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(300);
  expect((await drawnShipBox(page)).x).toBeGreaterThan(before.x + 50);
  upright(await wings(page, testInfo, 'right-moving'), level);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  upright(await wings(page, testInfo, 'replay-level'), level);
});

test('horizontal movement keeps the hull upright and uncompressed while moving, stopped and held at an edge', async ({ page }, testInfo) => {
  await enter(page);
  const level = await wings(page, testInfo, 'level');
  const before = await drawnShipBox(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(240);
  const right = await wings(page, testInfo, 'right');

  expect((await drawnShipBox(page)).x).toBeGreaterThan(before.x + 50);
  upright(right, level);
  await page.keyboard.up('ArrowRight');
  await page.clock.runFor(400);
  upright(await wings(page, testInfo, 'stopped'), level);
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(240);
  const left = await wings(page, testInfo, 'left');

  upright(left, level);
  await page.clock.runFor(2600);
  upright(await wings(page, testInfo, 'held-at-left-edge'), level);
  await page.keyboard.up('ArrowLeft');
});

test('reduced motion keeps a level uncompressed hull while keyboard movement remains available', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  const level = await wings(page, testInfo, 'reduced-level');
  const before = await drawnShipBox(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(240);
  const moved = await wings(page, testInfo, 'reduced-moving');
  const after = await drawnShipBox(page);
  await page.keyboard.up('ArrowRight');
  expect(after.x).toBeGreaterThan(before.x + 50);
  expect(Math.abs(moved.drop)).toBeLessThan(1.5);
  expect(Math.abs(moved.width - level.width)).toBeLessThan(2);
});

test('slow relative dragging preserves the upright rendered hull after each target is reached', async ({ page }, testInfo) => {
  await enter(page);
  const level = await wings(page, testInfo, 'slow-level');
  await page.mouse.move(400, 500);
  await page.mouse.down();
  const before = await drawnShipBox(page);
  for (let step = 1; step <= 20; step++) {
    await page.mouse.move(400 + step * 2, 500);
    await page.clock.runFor(16);
  }
  expect((await drawnShipBox(page)).x).toBeGreaterThan(before.x + 15);
  upright(await wings(page, testInfo, 'slow-drag'), level);
  await page.mouse.up();
});

test('held horizontal and diagonal movement preserve the same visible hull as stopping', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2000, height: 1000 });
  await enter(page);
  const level = await wings(page, testInfo, 'held-level');
  const before = await drawnShipBox(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(300);
  upright(await wings(page, testInfo, 'held-right'), level);
  for (let i = 0; i < 3; i++) {
    await page.clock.runFor(100);
    upright(await wings(page, testInfo, `held-right-${i}`), level);
  }
  await page.keyboard.down('ArrowUp');
  await page.clock.runFor(100);
  upright(await wings(page, testInfo, 'held-diagonal'), level);
  const diagonal = await drawnShipBox(page);
  expect(diagonal.x).toBeGreaterThan(before.x + 100);
  expect(diagonal.y).toBeLessThan(before.y - 20);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
  await page.clock.runFor(300);
  upright(await wings(page, testInfo, 'held-stopped'), level);
});
