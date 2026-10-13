import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === '2d' ? get.call(this, kind, ...args) : null; };
  });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
});
async function enter(page) {
  await page.clock.runFor(10100);
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3100);
}
async function position(page) {
  return page.locator('.game-ship').evaluate(ship => { const m = new DOMMatrix(getComputedStyle(ship).transform); return { x: m.m41, y: m.m42 }; });
}
async function finger(page, type, x, y) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await client.detach();
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
  await expect(page.locator('.game-ship')).not.toHaveCSS('transform', /matrix\(/);
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
