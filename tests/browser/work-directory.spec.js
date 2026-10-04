import { test, expect } from '@playwright/test';

test('world and navigation open the same compact work directory', async ({ page }) => {
  await page.goto('/?world=system&seed=3');
  const world = page.getByRole('region', { name: '抽象系统空间 · 成长路径' });
  const entrance = world.getByRole('link', { name: '作品集', exact: true });
  await entrance.click();
  const panel = page.getByRole('region', { name: '作品', exact: true });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/#work$/);
  await expect(panel.locator('time')).toHaveText('2019');
  await expect(panel.getByText('精选作品', { exact: true })).toBeVisible();
  await expect(panel.getByText('架构设计', { exact: true })).toBeVisible();
  await expect(panel.getByText('对话编排', { exact: true })).toBeVisible();
  const item = panel.locator('summary');
  const description = panel.getByText('将流转驱动与对话内容分离，通过可组合的 Action 支持业务扩展。', { exact: true });
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
  expect(new URL(page.url()).search).toBe('?world=system&seed=3');
});

test('work directory preserves all four worlds and their safe band', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  for (const [form, seed] of [['island', 0], ['island', 4], ['system', 2], ['system', 3]]) {
    await page.goto(`/?world=${form}&seed=${seed}`);
    const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
    const image = world.getByRole('img');
    await expect(image).toBeVisible();
    await image.screenshot({ animations: 'disabled' });
    const before = await image.boundingBox();
    await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: '作品', exact: true });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThan(before.x + before.width + 27);
    await panel.locator('summary').click();
    await page.mouse.move(1023, 767);
    const after = await image.boundingBox();
    for (const axis of ['x', 'y', 'width', 'height']) expect(after[axis]).toBeCloseTo(before[axis], 2);
    await page.goBack();
    await expect(panel).toBeHidden();
    await page.goForward();
    await expect(panel).toBeVisible();
    expect(new URL(page.url()).search).toBe(`?world=${form}&seed=${seed}`);
  }
});

test('direct work links survive reload and scroll within a short window without WebGL', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 400 });
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?world=island&seed=0#work');
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
