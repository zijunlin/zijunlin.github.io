import { test, expect } from '@playwright/test';

test('world and navigation open the same compact work directory', async ({ page }) => {
  // Directory interactions do not need continuous background frames.
  await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
  await page.goto('/?seed=3');
  await page.clock.runFor(1000);
  const world = page.getByRole('region', { name: '星辰圆点 · 成长路径' });
  const entrance = world.getByRole('link', { name: '作品集', exact: true });
  await entrance.click();
  const panel = page.getByRole('region', { name: '作品', exact: true });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/#work$/);
  await expect(panel.locator('time')).toHaveText(['2019', '2013', '2016', '2017']);
  await expect(panel.getByText('精选作品', { exact: true })).toBeVisible();
  await expect(panel.getByText('平台主导', { exact: true })).toBeVisible();
  await expect(panel.getByText('客户导向', { exact: true })).toBeVisible();
  const item = panel.locator('summary');
  const description = panel.getByText('在阿里任职期间，主导营收达千万级的智能电话项目，通过分离对话流转与内容、构建可组合的 Action，让平台能够灵活支持业务扩展。', { exact: true });
  await panel.getByRole('heading').hover();
  await expect(description).toBeHidden();
  await item.hover();
  await expect(description).toBeVisible();
  await item.click();
  await panel.getByRole('heading').hover();
  await expect(description).toBeVisible();
  await expect(panel.getByRole('link', { name: '查看作品预览' })).toHaveAttribute('href', '#work/platform');
  await panel.getByRole('link', { name: '关闭作品' }).click();
  await expect(entrance).toBeFocused();
  const nav = page.getByRole('navigation').getByRole('link', { name: '作品', exact: true });
  await nav.click();
  await expect(panel).toBeVisible();
  await expect(nav).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(nav).toBeFocused();
  expect(new URL(page.url()).search).toBe('?seed=3');
});

test('work directory preserves both layouts and panel state', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const seed of [0, 4]) {
    await page.goto(`/?seed=${seed}`);
    const world = page.getByRole('region', { name: /星辰圆点/ });
    const image = world.locator('.celestial-stage');
    await expect(image).toBeVisible();
    await image.screenshot({ animations: 'disabled' });
    const before = await image.boundingBox();
    await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: '作品', exact: true });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    await panel.locator('summary').click();
    await page.mouse.move(1023, 767);
    const after = await image.boundingBox();
    for (const axis of ['x', 'y', 'width', 'height']) expect(after[axis]).toBeCloseTo(before[axis], 2);
    await page.goBack();
    await expect(panel).toBeHidden();
    await page.goForward();
    await expect(panel).toBeVisible();
    expect(new URL(page.url()).search).toBe(`?seed=${seed}`);
  }
});

test('direct work links survive reload and scroll within a short window without WebGL', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 400 });
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?seed=0#work');
  await page.reload();
  const panel = page.getByRole('region', { name: '作品', exact: true });
  await expect(panel).toBeVisible();
  await panel.locator('summary').click();
  const preview = panel.getByRole('link', { name: '查看作品预览' });
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toBeInViewport();
  await expect(panel.getByRole('link', { name: '关闭作品' })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation').getByRole('link', { name: '作品', exact: true })).toBeFocused();
});
