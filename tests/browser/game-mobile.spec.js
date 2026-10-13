import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === '2d' ? get.call(this, kind, ...args) : null; };
  });
  await page.clock.install({ time: new Date('2026-10-13T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-13T00:00:01Z'));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
});
async function enter(page) {
  await page.clock.runFor(10100);
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3100);
}
async function position(page) {
  return page.locator('.game-ship').evaluate(ship => { const m = new DOMMatrix(getComputedStyle(ship).transform); return { x: m.m41, y: m.m42 }; });
}
const fingers = new WeakMap();
async function finger(page, type, x, y) {
  const client = fingers.get(page) ?? await page.context().newCDPSession(page);
  fingers.set(page, client);
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  if (type === 'touchEnd' || type === 'touchCancel') { await client.detach(); fingers.delete(page); }
}

test('relative drag, release, shockwave, pause, height resize and orientation', async ({ page }) => {
  await enter(page);
  const initial = await position(page);
  await finger(page, 'touchStart', 120, 500);
  await page.clock.runFor(32);
  expect(await position(page)).toEqual(initial);
  await finger(page, 'touchMove', 180, 470);
  await page.clock.runFor(240);
  expect((await position(page)).x).toBeGreaterThan(initial.x + 60);
  await finger(page, 'touchEnd');
  const stopped = await position(page);
  await page.clock.runFor(100);
  expect(await position(page)).toEqual(stopped);
  await page.getByRole('button', { name: '冲击波', exact: true }).tap();
  await page.clock.runFor(32);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
  await page.setViewportSize({ width: 390, height: 760 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '暂停', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).tap();
  await page.clock.runFor(32);
  await page.screenshot({ path: '.scratch/mobile-game-landscape.png' });
  await page.getByRole('button', { name: '暂停', exact: true }).tap();
  await page.getByRole('button', { name: '结束本局', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: '本局结束' })).toBeVisible();
  await page.getByRole('button', { name: '再来一局', exact: true }).tap();
  await page.clock.runFor(32);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.getByRole('button', { name: '暂停', exact: true }).tap();
  await page.getByRole('button', { name: '结束本局', exact: true }).tap();
  await page.getByRole('button', { name: '返回首页', exact: true }).tap();
  await page.clock.runFor(1800);
  await expect(page.locator('.space-game')).toHaveCount(0);
});

test('holding an orb defers entry, dragging does not open content, and release enters', async ({ page }) => {
  await page.clock.runFor(9000);
  const box = await page.locator('.celestial-gate').first().boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await finger(page, 'touchStart', x, y);
  await finger(page, 'touchMove', x + 24, y);
  await page.clock.runFor(2000);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await finger(page, 'touchEnd');
  await page.clock.runFor(200);
  await expect(page).not.toHaveURL(/#about/);
  await expect(page.locator('.space-game')).toBeVisible();
});

test('orb drag preserves orbit motion and tapping still opens content', async ({ page }) => {
  const orb = page.locator('.celestial-gate').first();
  const box = await orb.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await finger(page, 'touchStart', x, y);
  await finger(page, 'touchMove', x + 24, y);
  await finger(page, 'touchEnd');
  const before = await orb.evaluate(node => node.style.left);
  await page.clock.runFor(1000);
  expect(await orb.evaluate(node => node.style.left)).not.toEqual(before);
  await expect(page).not.toHaveURL(/#about/);
  await orb.tap();
  await expect(page.locator('#about-panel-title')).toBeVisible();
});

test('a second finger cancels pending movement until all fingers are released', async ({ page }) => {
  await enter(page);
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 500, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 280, y: 500, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 280, y: 500, id: 1 }, { x: 120, y: 600, id: 2 }] });
  const stopped = await position(page);
  await page.clock.runFor(200);
  expect(await position(page)).toEqual(stopped);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
});

test('mobile combat canvas uses viewport pixel density instead of magnifying its backing store', async ({ page }) => {
  await enter(page);
  const raster = await page.locator('.game-effects').evaluate(canvas => ({
    width: canvas.width, height: canvas.height,
    expectedWidth: 390,
    expectedHeight: 844,
  }));
  expect(raster.width).toBeCloseTo(raster.expectedWidth, 0);
  expect(raster.height).toBeCloseTo(raster.expectedHeight, 0);
});
