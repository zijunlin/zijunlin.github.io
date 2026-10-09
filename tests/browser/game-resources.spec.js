import { test, expect } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test('resource diamonds become a visible triple-shot upgrade and replay resets it', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .5;
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) { return this.id === 'shader-canvas' ? null : context.apply(this, args); };
  });
  await page.clock.install(); await page.goto('/');
  await page.clock.runFor(10100);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await expect(page.locator('.game-weapon')).toHaveText('武器等级: 0');
  await page.clock.runFor(6000);
  const greenPixels = await page.locator('.game-effects').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === 120 && data[i + 1] === 244 && data[i + 2] === 196) count++;
    return count;
  });
  expect(greenPixels).toBeGreaterThan(10);
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(1700); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.game-weapon')).toContainText('武器等级: 1');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.game-weapon')).toContainText('Weapon level: 1');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(page.locator('.game-weapon')).toHaveText('Weapon level: 0');
});
