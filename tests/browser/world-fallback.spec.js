import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('world remains usable when randomUUID is unavailable on local HTTP', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined }); });
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await expect(page.getByRole('alert')).toBeHidden();
  await page.getByRole('link', { name: '随笔', exact: true }).click();
  await expect(page.getByRole('region', { name: '随笔', exact: true })).toBeVisible();
});

for (const resource of ['world-scene', 'world-view']) {
  test(`${resource} download failure preserves content and work previews`, async ({ page }) => {
    await page.route(`**/assets/${resource}-*.js`, route => route.abort());
    await page.goto('/?seed=4#career');
    const fallback = page.getByRole('alert');
    await expect(fallback).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    await expect(page.getByRole('region', { name: '职业历程', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await fallback.getByRole('link', { name: '作品', exact: true }).click();
    await page.locator('.work-item summary').click();
    await page.getByRole('link', { name: '查看作品预览' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: '作品', exact: true })).toBeVisible();
    await expect(fallback).not.toContainText(/Error|stack|import|THREE/);
  });
}

test('graphics failure keeps a static keyboard-accessible home and explains unavailable games', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const gameRequests = [];
  page.on('request', request => { if (/space-game.*\.(js|css)/.test(request.url())) gameRequests.push(request.url()); });
  await page.goto('/?seed=0');
  await expect(page.locator('#shader-canvas')).toBeHidden();
  const home = page.getByRole('region', { name: '继续浏览内容' });
  await expect(home.getByRole('link')).toHaveCount(4);
  await page.screenshot({ path: test.info().outputPath('static-home.png'), animations: 'disabled' });
  await expect(page.locator('#world-entry svg')).toHaveCount(0);
  const notes = home.getByRole('link', { name: '心得', exact: true });
  await notes.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: '随笔', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+G');
  await expect(page.getByRole('dialog')).toContainText('当前图形功能不可用，暂时无法开始游戏');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(home).toBeVisible();
  await expect(page.locator('.space-game')).toHaveCount(0);
  expect(gameRequests).toEqual([]);
});
