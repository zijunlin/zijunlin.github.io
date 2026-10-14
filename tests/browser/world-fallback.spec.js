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

test('celestial entrances and content remain usable without any WebGL context', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?seed=0');
  await expect(page.locator('#shader-canvas')).toBeHidden();
  await expect(page.getByRole('alert')).toBeHidden();
  const world = page.getByRole('region', { name: '星辰圆点 · 环绕核心' });
  await expect(world.getByRole('link')).toHaveCount(4);
  await world.getByRole('link', { name: '随笔', exact: true }).click();
  await expect(page.getByRole('region', { name: '随笔', exact: true })).toBeVisible();
});
