import { test, expect } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.clock.install();
});

test('invites once after eligible dwell and loads only after acceptance', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(10100);
  await expect(page.getByRole('dialog', { name: '来一场星际冒险？' })).toBeVisible();
  expect(requests.filter(url => /space-game.*\.(js|css)/.test(url))).toEqual([]);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await expect(page.getByText('游戏已就绪')).toBeVisible();
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(11000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reading pauses dwell and declining consumes the invitation', async ({ page }) => {
  await page.goto('/#about');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
  await page.locator('nav a[href="#"]').click();
  await page.clock.runFor(10100);
  await page.getByRole('button', { name: '暂时不了' }).click();
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
});

test('a cancelled delayed import cannot take over the home page', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/space-game-*.js*', async route => { await pending; await route.continue(); });
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(10100);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  release();
  await page.clock.runFor(2000);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
});

test('mobile screens never receive an invitation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(20000);
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('#about-panel-title')).toBeVisible();
});

test('a failed load can be retried or dismissed without losing the site', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/space-game-*.js*', route => fail ? route.abort() : route.continue());
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(10100);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await expect(page.getByText('加载失败，请重试')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByText('游戏已就绪')).toBeVisible();
  await expect(page.locator('.space-game')).toHaveCSS('position', 'fixed');
});

test('English invitation restores focus and hidden time does not count', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(10100);
  await expect(page.getByRole('dialog', { name: 'Ready for a space adventure?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeFocused();
});

test('world failure prevents invitations', async ({ page }) => {
  await page.route('**/assets/world-scene-*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#world-error')).toBeVisible();
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
});

test('navigation invalidates a preparing game and preserves content focus', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/space-game-*.js*', async route => { await pending; await route.continue(); });
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await page.evaluate(() => { location.hash = '#about'; });
  await expect(page.locator('#about-panel-title')).toBeFocused();
  release();
  await page.clock.runFor(1000);
  await expect(page.locator('.space-game, [data-game-dialog]')).toHaveCount(0);
  await expect(page.locator('#about-panel-title')).toBeFocused();
});
