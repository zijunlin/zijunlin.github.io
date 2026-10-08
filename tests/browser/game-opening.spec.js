import { test, expect } from '@playwright/test';
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.clock.install();
});
async function enter(page) {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeVisible();
}
test('opening retains the world and navigation, then restores original entrances', async ({ page }) => {
  await enter(page);
  const original = await page.locator('.celestial-gate').first().elementHandle();
  await page.clock.runFor(3100);
  await expect(page.getByText('飞船已就位')).toBeVisible();
  await expect(page.locator('.game-satellite')).toHaveCount(4);
  await page.screenshot({ path: '.scratch/home-space-game-build/opening-ready.png' });
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
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
  await expect(page.getByText('飞船已就位')).toBeVisible();
  await page.keyboard.press('Escape');
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
  await expect(page.getByText('飞船已就位')).toBeVisible();
});
test('reduced motion still reaches the same playable formation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await page.clock.runFor(3100);
  await expect(page.getByText('飞船已就位')).toBeVisible();
  await page.screenshot({ path: '.scratch/home-space-game-build/opening-reduced.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
});
