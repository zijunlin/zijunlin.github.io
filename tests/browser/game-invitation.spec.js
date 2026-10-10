import { test, expect } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.clock.install();
});

test('automatically opens once after eligible dwell and loads lazily', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(9000);
  expect(requests.filter(url => /space-game.*\.(js|css)/.test(url))).toEqual([]);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await page.clock.runFor(1100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.clock.runFor(1700);
  await page.clock.runFor(11000);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reading pauses dwell and exiting consumes automatic entry', async ({ page }) => {
  await page.goto('/#about');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog], .space-game')).toHaveCount(0);
  await page.locator('nav a[href="#"]').click();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.clock.runFor(1700);
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog], .space-game')).toHaveCount(0);
});

test('a cancelled delayed import cannot take over the home page', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/space-game-*.js*', async route => { await pending; await route.continue(); });
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(10100);
  await page.clock.runFor(400);
  await expect(page.getByRole('status')).toContainText('正在准备游戏');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  release();
  await page.clock.runFor(2000);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
});

test('mobile screens never automatically enter the game', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(20000);
  await expect(page.locator('[data-game-dialog], .space-game')).toHaveCount(0);
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
  await expect(page.getByText('加载失败，请重试')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByText('正在集结')).toBeVisible();
  await expect(page.locator('.space-game')).toHaveCSS('position', 'fixed');
});

test('English automatic entry restores focus and hidden time does not count', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog], .space-game')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(10100);
  await expect(page.getByText('Assembling', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.clock.runFor(1700);
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeFocused();
});

test('world failure prevents automatic entry', async ({ page }) => {
  await page.route('**/assets/world-scene-*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#world-error')).toBeVisible();
  await page.clock.runFor(11000);
  await expect(page.locator('[data-game-dialog], .space-game')).toHaveCount(0);
});

test('navigation invalidates a preparing game and preserves content focus', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/space-game-*.js*', async route => { await pending; await route.continue(); });
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await page.evaluate(() => { location.hash = '#about'; });
  await expect(page.locator('#about-panel-title')).toBeFocused();
  release();
  await page.clock.runFor(1000);
  await expect(page.locator('.space-game, [data-game-dialog]')).toHaveCount(0);
  await expect(page.locator('#about-panel-title')).toBeFocused();
});

test('a reload starts a new visit with a fresh automatic entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.clock.runFor(1700);
  await page.clock.runFor(11000);
  await expect(page.locator('.space-game, [data-game-dialog]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('game shortcut ignores typing, other modifiers, reading and small windows', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.keyboard.press('g');
  await page.keyboard.press('Control+Shift+G');
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
  await page.evaluate(() => {
    const input = document.createElement('input'); input.id = 'shortcut-input';
    document.body.append(input); input.focus();
  });
  await page.keyboard.press('Shift+G');
  await expect(page.locator('#shortcut-input')).toHaveValue('G');
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
  await page.locator('nav a[href="#about"]').click();
  await page.keyboard.press('Shift+G');
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
  await page.locator('nav a[href="#"]').click();
  await page.setViewportSize({ width: 700, height: 500 });
  await page.keyboard.press('Shift+G');
  await expect(page.locator('[data-game-dialog]')).toHaveCount(0);
});
