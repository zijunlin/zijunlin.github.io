import { test, expect } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test.setTimeout(150000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .5;
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) { return this.id === 'shader-canvas' ? null : context.apply(this, args); };
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
});
test('fresh Space works after its release happened outside the game window', async ({ page }) => {
  await page.keyboard.press('p');
  await page.keyboard.down('Space');
  // Headless tabs retain OS focus. Model the lost event at the browser boundary,
  // while keeping trusted keyboard input and native button activation.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.addEventListener('keyup', event => { event.preventDefault(); event.stopImmediatePropagation(); }, { capture: true, once: true });
  });
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.press('Space');
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
});

test('Space natively activates Resume, Replay and Return without queuing a shockwave', async ({ page }) => {
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: '继续游戏', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '再来一局', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await page.clock.runFor(1700);
  await expect(page.locator('.space-game')).toHaveCount(0);
});

test('a fresh Space immediately after resume is not confused with the previous pulse', async ({ page }) => {
  await page.clock.runFor(12000);
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(1700); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.game-shockwave')).toContainText('2 / 3');
  await page.keyboard.press('Space');
  await page.clock.runFor(16);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.press('p');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.keyboard.press('Space');
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
});

test('holding Space across focus loss and resume does not release a charge', async ({ page }) => {
  await page.keyboard.press('p');
  await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.keyboard.down('Space');
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
});

test('Space on a focused site control preserves its native action during combat', async ({ page }) => {
  await page.getByRole('button', { name: 'English', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByText('Space survival', { exact: true })).toBeVisible();
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
});
