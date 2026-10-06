import { test, expect } from '@playwright/test';

test('unsupported world skips rendering assets and keeps every content destination usable', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/?world=system&seed=3');
  const fallback = page.getByRole('region', { name: '继续浏览内容' });
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText('当前浏览器暂时无法展示完整世界，你仍可浏览全部内容。');
  expect(requests.some(url => /world-view-/.test(url))).toBe(false);
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  for (const [name, route, title] of [['关于我', 'about', '关于我'], ['作品', 'work', '作品'], ['心得', 'notes', '随笔'], ['职业历程', 'career', '职业历程']]) {
    await fallback.getByRole('link', { name, exact: true }).click();
    const panel = page.getByRole('region', { name: title, exact: true });
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#${route}$`));
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(fallback.getByRole('link', { name, exact: true })).toBeFocused();
  }
  const [detail] = await Promise.all([
    page.waitForEvent('popup'),
    fallback.getByRole('link', { name: '阅读智能语音平台案例' }).click(),
  ]);
  try {
    await expect(detail.getByRole('article')).toBeVisible();
    await expect(detail).toHaveURL(/\/platform\.html$/);
  } finally { await detail.close(); }
  await expect(page.getByRole('navigation', { name: '主目录' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/WebGL|Shader|Error:|stack|THREE/);
});

for (const failure of ['context rejected', 'resize unavailable']) {
  test(`${failure} is detected before rendering assets load`, async ({ page }) => {
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => {
      if (mode === 'resize unavailable') window.ResizeObserver = undefined;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === 'webgl') return null;
        if (mode === 'context rejected' && type === 'webgl2') throw new Error('INTERNAL_WORLD_TEST');
        return original.call(this, type, ...args);
      };
    }, failure);
    await page.goto('/?world=island&seed=0#about');
    await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '继续浏览内容' })).toBeVisible();
    expect(requests.some(url => /world-view-/.test(url))).toBe(false);
    await expect(page.locator('body')).not.toContainText(/INTERNAL_WORLD_TEST|WebGL|Shader/);
    expect(errors).toEqual([]);
  });
}

test('runtime rendering loss preserves the open panel and restores content access', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/?world=system&seed=3#career');
  const image = page.getByRole('img', { name: '层叠曲面系统空间' });
  await expect(image).toBeVisible();
  await image.evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  const fallback = page.getByRole('region', { name: '继续浏览内容' });
  await expect(fallback).toBeVisible();
  await expect(image).toHaveCount(0);
  await expect(page.getByRole('region', { name: '职业历程', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\?world=system&seed=3#career$/);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.keyboard.press('Escape');
  await fallback.getByRole('link', { name: '心得', exact: true }).click();
  await expect(page.getByRole('region', { name: '随笔', exact: true })).toBeVisible();
  await page.reload();
  await expect(image).toBeVisible();
  await expect(fallback).toHaveCount(0);
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  expect(errors).toEqual([]);
});

test('losing rendering capability during initialization ends loading with content access', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : context.call(this, type, ...args);
    };
    const link = WebGL2RenderingContext.prototype.linkProgram;
    let lost = false;
    WebGL2RenderingContext.prototype.linkProgram = function(program) {
      link.call(this, program);
      if (!lost) {
        lost = true;
        queueMicrotask(() => this.getExtension('WEBGL_lose_context').loseContext());
      }
    };
  });
  await page.goto('/?world=system&seed=3');
  await expect(page.getByRole('region', { name: '继续浏览内容' })).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.getByRole('img', { name: '层叠曲面系统空间' })).toHaveCount(0);
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  expect(errors).toEqual([]);
});

test('a failed world shader shows content access instead of a broken scene or diagnostics', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Shader Error|INTERNAL_WORLD_TEST/.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : context.call(this, type, ...args);
    };
    const parameter = WebGL2RenderingContext.prototype.getProgramParameter;
    WebGL2RenderingContext.prototype.getProgramParameter = function(program, name) {
      return name === this.LINK_STATUS ? false : parameter.call(this, program, name);
    };
  });
  await page.goto('/?world=island&seed=4');
  await expect(page.getByRole('region', { name: '继续浏览内容' })).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.getByRole('img', { name: '层叠曲面小岛' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const chunk of ['world-scene', 'world-view']) {
  test(`failed ${chunk} downloads retain content access without exposing diagnostics`, async ({ page }) => {
    await page.route(`**/assets/${chunk}-*.js`, route => route.abort());
    await page.goto('/?world=island&seed=0#notes');
    const notes = page.getByRole('region', { name: '随笔', exact: true });
    await expect(notes).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    await page.keyboard.press('Escape');
    const fallback = page.getByRole('region', { name: '继续浏览内容' });
    await expect(fallback).toBeVisible();
    await fallback.getByRole('link', { name: '职业历程', exact: true }).click();
    await expect(page.getByRole('region', { name: '职业历程', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('世界暂时无法显示');
    await expect(page.getByRole('alert')).not.toContainText(/WebGL|Shader|Error|stack|import|THREE/);
  });
}
