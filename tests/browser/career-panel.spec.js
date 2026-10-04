import { test, expect } from '@playwright/test';
test.describe.configure({ timeout: 60000 });

test('career entrance shows the approved timeline and associated work', async ({ page }) => {
  await page.goto('/?world=system&seed=3');
  const world = page.getByRole('region', { name: '抽象系统空间 · 成长路径' });
  await expect(world.getByRole('link', { name: '职业历程', exact: true })).toBeVisible();
  await world.getByRole('link', { name: '职业历程', exact: true }).click();
  const panel = page.getByRole('region', { name: '职业历程', exact: true });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/#career$/);
  await expect(panel.locator('time')).toHaveText(['2013', '2016', '2017', '2019', '2026']);
  await expect(panel.getByRole('heading', { level: 3 })).toHaveText(['来往', '点点虫', '菜鸟 · 裹裹', '智能语音平台', 'AI 探索']);
  const work = panel.getByRole('link', { name: '查看关联作品：智能语音平台' });
  await expect(work).toHaveAttribute('href', '#work/platform');
  await work.click();
  await expect(page).toHaveURL(/#work\/platform$/);
  await page.goBack();
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: '关闭职业历程' }).click();
  await expect(panel).toBeHidden();
  await expect(world.getByRole('link', { name: '职业历程', exact: true })).toBeFocused();
});

test('about to career preserves panel hierarchy for back, close and home', async ({ page }) => {
  await page.goto('/?world=island&seed=0');
  const nav = page.getByRole('navigation');
  const about = page.getByRole('region', { name: '关于我', exact: true });
  const career = page.getByRole('region', { name: '职业历程', exact: true });
  await nav.getByRole('link', { name: '关于', exact: true }).click();
  const secondary = about.getByRole('link', { name: '查看职业历程' });
  await expect(secondary).toBeVisible();
  await secondary.click();
  await expect(career).toBeVisible();
  await expect(about).toBeHidden();
  await page.goBack();
  await expect(about).toBeVisible();
  await expect(secondary).toBeFocused();
  await page.goForward();
  await expect(career).toBeVisible();
  await career.getByRole('link', { name: '关闭职业历程' }).click();
  await expect(about).toBeVisible();
  await expect(secondary).toBeFocused();
  await about.getByRole('link', { name: '关闭关于我' }).click();
  await expect(about).toBeHidden();
  await expect(nav.getByRole('link', { name: '关于', exact: true })).toBeFocused();
  await nav.getByRole('link', { name: '关于', exact: true }).click();
  await secondary.click();
  await nav.getByRole('link', { name: '首页', exact: true }).click();
  await expect(career).toBeHidden();
  await expect(about).toBeHidden();
  await expect(nav.getByRole('link', { name: '首页', exact: true })).toBeFocused();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  expect(new URL(page.url()).search).toBe('?world=island&seed=0');
});

test('direct career links reload and remain readable without WebGL', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?world=system&seed=3#career');
  const career = page.getByRole('region', { name: '职业历程', exact: true });
  await expect(career).toBeVisible();
  await page.reload();
  await expect(career).toBeVisible();
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  await page.keyboard.press('Escape');
  await expect(career).toBeHidden();
  await expect(page.getByRole('navigation').getByRole('link', { name: '首页', exact: true })).toBeFocused();
});

test('career fits all four worlds without moving or covering their entrances', async ({ page }) => {
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
    const frame = await image.boundingBox();
    await world.getByRole('link', { name: '职业历程', exact: true }).focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: '职业历程', exact: true });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThan(frame.x + frame.width + 27);
    await page.mouse.move(1023, 767);
    const after = await image.boundingBox();
    for (const axis of ['x', 'y', 'width', 'height']) expect(after[axis]).toBeCloseTo(frame[axis], 2);
    await panel.getByRole('heading', { name: 'AI 探索' }).scrollIntoViewIfNeeded();
    await expect(panel.getByRole('heading', { name: 'AI 探索' })).toBeInViewport();
    await expect(panel.getByRole('link', { name: '关闭职业历程' })).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
});
