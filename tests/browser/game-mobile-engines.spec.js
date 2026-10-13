import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test.setTimeout(90000);
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-13T00:00:00Z'));
});
async function ready(page, background = false) {
  if (!background) await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      return this.id === 'shader-canvas' ? null : get.apply(this, args);
    };
  });
  await page.goto('/?seed=0');
  await expect(page.locator('#world-entry')).toBeVisible();
}
async function enter(page) {
  await page.clock.runFor(10100);
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3200);
}
async function insideViewport(page, locator) {
  const box = await locator.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
}
for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`mobile complete journey with ${reducedMotion}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion });
    await ready(page);
    await page.locator('.celestial-gate').first().tap();
    await expect(page.locator('#about-panel-title')).toBeVisible();
    await page.clock.runFor(11000);
    await expect(page.locator('.space-game')).toHaveCount(0);
    await page.locator('nav a[href="#"]').tap();
    await enter(page);
    for (const name of ['暂停', '冲击波']) await insideViewport(page, page.getByRole('button', { name, exact: true }));
    await page.screenshot({ path: info.outputPath('portrait.png') });
    const ship = page.locator('.game-ship');
    const before = await ship.boundingBox();
    // Mouse events exercise the shared relative-pointer path in WebKit;
    // they do not claim real iPhone touch-drag coverage.
    await page.mouse.move(100, 500);
    await page.mouse.down();
    await page.mouse.move(160, 470);
    await page.clock.runFor(180);
    await page.mouse.up();
    expect((await ship.boundingBox()).x).toBeGreaterThan(before.x + 20);
    await page.getByRole('button', { name: '冲击波', exact: true }).tap();
    await page.clock.runFor(32);
    await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
    await page.setViewportSize({ width: 390, height: 760 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
    await page.getByRole('button', { name: '继续游戏', exact: true }).tap();
    await page.clock.runFor(32);
    for (const name of ['暂停', '冲击波']) await insideViewport(page, page.getByRole('button', { name, exact: true }));
    await page.screenshot({ path: info.outputPath('landscape.png') });
    await page.getByRole('button', { name: '暂停', exact: true }).tap();
    await page.getByRole('button', { name: '结束本局', exact: true }).tap();
    await page.getByRole('button', { name: '再来一局', exact: true }).tap();
    await page.clock.runFor(32);
    await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
    await page.getByRole('button', { name: '暂停', exact: true }).tap();
    await page.getByRole('button', { name: '结束本局', exact: true }).tap();
    await page.getByRole('button', { name: '返回首页', exact: true }).tap();
    await page.clock.runFor(1800);
    await page.clock.runFor(11000);
    await expect(page.locator('.space-game')).toHaveCount(0);
    await expect(page.locator('.celestial-gate').first()).toBeVisible();
  });
}

test('navigation cancels delayed mobile loading without a later takeover', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/space-game-*.js*', async route => { await pending; await route.continue(); });
  await ready(page);
  await page.clock.runFor(10500);
  await expect(page.getByRole('status')).toContainText('正在准备游戏');
  await page.locator('nav a[href="#about"]').tap();
  release();
  await expect(page.locator('#about-panel-title')).toBeVisible();
  await page.clock.runFor(4000);
  await expect(page.locator('.space-game')).toHaveCount(0);
});


test('real background remains visible in portrait and landscape', async ({ page }, info) => {
  await page.clock.resume();
  await ready(page, true);
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
  await expect(page.getByRole('button', { name: '冲击波', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '暂停', exact: true }).tap();
  await page.screenshot({ path: info.outputPath('background-portrait.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: '继续游戏', exact: true }).tap();
  await page.getByRole('button', { name: '暂停', exact: true }).tap();
  await page.screenshot({ path: info.outputPath('background-landscape.png') });
});
