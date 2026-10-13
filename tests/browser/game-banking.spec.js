import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

test.use({ deviceScaleFactor: 3 });
test.setTimeout(150000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .5;
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      return this.id === 'shader-canvas' ? null : context.apply(this, args);
    };
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
});
async function enter(page) {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
}
// Read the rendered hull, independently of CSS transforms or runtime state.
async function wings(page, testInfo, name) {
  const screenshot = await page.locator('.game-ship').screenshot({ path: testInfo.outputPath(name + '.png') });
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  const png = PNG.sync.read(screenshot), pixels = [];
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4;
    if (Math.abs(png.data[i] - 167) < 14 && Math.abs(png.data[i + 1] - 233) < 14 && Math.abs(png.data[i + 2] - 237) < 14) pixels.push({ x, y });
  }
  expect(pixels.length).toBeGreaterThan(25);
  const left = Math.min(...pixels.map(p => p.x)), right = Math.max(...pixels.map(p => p.x));
  const meanY = points => points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { drop: meanY(pixels.filter(p => p.x >= right - 1)) - meanY(pixels.filter(p => p.x <= left + 1)), width: right - left };
}

test('replaying immediately restores a level ship after ending while banked', async ({ page }, testInfo) => {
  await enter(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(300);
  expect((await wings(page, testInfo, 'right-bank')).drop).toBeGreaterThan(3);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  expect(Math.abs((await wings(page, testInfo, 'replay-level')).drop)).toBeLessThan(1);
});

test('horizontal movement lowers its leading wing, compresses the hull, and levels after stopping or reaching an edge', async ({ page }, testInfo) => {
  await enter(page);
  const level = await wings(page, testInfo, 'level');
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(240);
  const right = await wings(page, testInfo, 'right');
  expect(right.drop).toBeGreaterThan(3);
  expect(right.width).toBeLessThan(level.width);
  await page.keyboard.up('ArrowRight');
  await page.clock.runFor(400);
  expect(Math.abs((await wings(page, testInfo, 'stopped')).drop)).toBeLessThan(1.5);
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(240);
  const left = await wings(page, testInfo, 'left');
  expect(left.drop).toBeLessThan(-3);
  expect(left.width).toBeLessThan(level.width);
  await page.clock.runFor(2600);
  expect(Math.abs((await wings(page, testInfo, 'held-at-left-edge')).drop)).toBeLessThan(1.5);
  await page.keyboard.up('ArrowLeft');
});

test('reduced motion keeps a level uncompressed hull while keyboard movement remains available', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  const level = await wings(page, testInfo, 'reduced-level');
  const before = await page.locator('.game-ship').boundingBox();
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(240);
  const moved = await wings(page, testInfo, 'reduced-moving');
  const after = await page.locator('.game-ship').boundingBox();
  await page.keyboard.up('ArrowRight');
  expect(after.x).toBeGreaterThan(before.x + 50);
  expect(Math.abs(moved.drop)).toBeLessThan(1.5);
  expect(Math.abs(moved.width - level.width)).toBeLessThan(2);
});

test('slow relative dragging banks the rendered hull even after each target is reached', async ({ page }, testInfo) => {
  await enter(page);
  await page.mouse.move(400, 500);
  await page.mouse.down();
  const before = await page.locator('.game-ship').boundingBox();
  for (let step = 1; step <= 20; step++) {
    await page.mouse.move(400 + step, 500);
    await page.clock.runFor(16);
  }
  expect((await page.locator('.game-ship').boundingBox()).x).toBeGreaterThan(before.x + 15);
  expect((await wings(page, testInfo, 'slow-drag')).drop).toBeGreaterThan(1);
  await page.mouse.up();
});
