import { test, expect } from '@playwright/test';

test('steady drawing avoids GPU error queries and an expired recovery stays in fallback', async ({ page }) => {
  await page.addInitScript(() => {
    window.errorQueries = 0;
    const getError = WebGLRenderingContext.prototype.getError;
    WebGLRenderingContext.prototype.getError = function () { window.errorQueries++; return getError.call(this); };
  });
  await page.goto('/?seed=0');
  const canvas = page.locator('#shader-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  const before = await page.evaluate(() => window.errorQueries);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.errorQueries)).toBe(before);
  await canvas.evaluate(el => el.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
  await expect(canvas).toBeHidden();
  await expect(canvas).toHaveAttribute('data-motion', 'static');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(canvas).toBeHidden();
  await expect(page.getByRole('region', { name: '继续浏览内容' }).getByRole('link')).toHaveCount(4);
});

test('a WebGL allocation error preserves the static fallback', async ({ page }) => {
  await page.addInitScript(() => { WebGLRenderingContext.prototype.getError = () => 1285; });
  await page.goto('/');
  await expect(page.locator('#shader-canvas')).toBeHidden();
  await expect(page.getByRole('region', { name: '继续浏览内容' }).getByRole('link')).toHaveCount(4);
});

test('the shared surface keeps foreground density across viewport changes within its pixel budget', async ({ browser, baseURL }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
  try {
    await page.goto(`${baseURL}/?seed=0`);
    const canvas = page.locator('#shader-canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate(el => el.width)).toBe(3840);
    await expect.poll(() => canvas.evaluate(el => el.height)).toBe(2160);
    for (const viewport of [{ width: 390, height: 844 }, { width: 720, height: 1280 }, { width: 2560, height: 1440 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => canvas.evaluate(el => el.width / el.height)).toBeCloseTo(viewport.width / viewport.height, 2);
      const size = await canvas.evaluate(el => ({ width: el.width, height: el.height }));
      expect(size.width * size.height).toBeLessThanOrEqual(3840 * 2160);
      expect(size.width).toBeGreaterThan(viewport.width);
      if (viewport.width === 390) {
        expect(size.width).toBe(1170);
        await page.screenshot({ path: test.info().outputPath('shared-surface-mobile-dpr3.png') });
      }
      await expect(page.getByRole('navigation', { name: '主目录' })).toBeVisible();
    }
  } finally { await page.close(); }
});

test('an initially unfocused page shows one frame and waits for focus before animating', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'hasFocus', { value: () => false });
  });
  await page.goto('/?seed=0');
  const canvas = page.locator('#shader-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(canvas).toHaveAttribute('data-motion', 'running');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
});

async function observeGraphics(page) {
  // Observe the browser's graphics boundary, never application state or shaders.
  await page.addInitScript(() => {
    const live = new Map(), contexts = new Set(), draws = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = original.apply(this, args);
      if (args[0] === 'webgl' && context) contexts.add(context);
      return context;
    };
    for (const kind of ['Shader', 'Program', 'Buffer', 'Texture', 'Framebuffer']) {
      const resources = new Set(); live.set(kind, resources);
      for (const operation of ['create', 'delete']) {
        const method = `${operation}${kind}`;
        const originalMethod = WebGLRenderingContext.prototype[method];
        WebGLRenderingContext.prototype[method] = function (...args) {
          const result = originalMethod.apply(this, args);
          if (operation === 'create' && result) resources.add(result);
          else if (operation === 'delete') resources.delete(args[0]);
          return result;
        };
      }
    }
    const targets = new WeakMap(), sizes = new WeakMap();
    const bind = WebGLRenderingContext.prototype.bindFramebuffer;
    WebGLRenderingContext.prototype.bindFramebuffer = function (target, buffer) {
      targets.set(this, buffer); return bind.call(this, target, buffer);
    };
    const viewport = WebGLRenderingContext.prototype.viewport;
    WebGLRenderingContext.prototype.viewport = function (x, y, width, height) {
      sizes.set(this, { width, height }); return viewport.call(this, x, y, width, height);
    };
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas.id === 'shader-canvas') draws.push({ offscreen: !!targets.get(this), ...sizes.get(this) });
      return draw.apply(this, args);
    };
    window.graphicsProbe = () => ({ contexts: contexts.size, draws: [...draws],
      live: Object.fromEntries([...live].map(([kind, values]) => [kind, values.size])) });
    window.clearGraphicsDraws = () => { draws.length = 0; };
  });
}

test('cached background and shared surface use separate cadences and survive repeated game visits', async ({ page }) => {
  test.setTimeout(90000);
  await observeGraphics(page);
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.goto('/?seed=0');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(100);
  await page.evaluate(() => window.clearGraphicsDraws());
  await page.clock.runFor(240);
  const initial = await page.evaluate(() => window.graphicsProbe());
  const cached = initial.draws.filter(draw => draw.offscreen);
  const presented = initial.draws.filter(draw => !draw.offscreen);
  expect(cached.length).toBeGreaterThan(0);
  expect(presented.length).toBeGreaterThan(cached.length * 1.5);
  expect(cached.every(draw => draw.width <= 960 && draw.height <= 600)).toBe(true);
  expect(presented.every(draw => draw.width === 1280 && draw.height === 800)).toBe(true);
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.keyboard.press('Shift+G');
    await expect(page.locator('.space-game')).toBeVisible();
    await page.clock.runFor(3300);
    if (!cycle) await page.screenshot({ path: test.info().outputPath('shared-surface-game.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '返回首页', exact: true }).click();
    await page.clock.runFor(1800);
    await expect(page.locator('.space-game')).toHaveCount(0);
    await page.setViewportSize({ width: 1100, height: 720 });
    await page.clock.runFor(32);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.clock.runFor(32);
    const next = await page.evaluate(() => window.graphicsProbe());
    expect(next.contexts).toBe(1);
    expect(next.live).toEqual(initial.live);
  }
  const canvas = page.locator('#shader-canvas');
  await canvas.evaluate(el => el.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
  await expect(canvas).toBeHidden();
  await page.clock.runFor(8100);
  await expect(page.getByRole('region', { name: '继续浏览内容' })).toBeVisible();
  await page.evaluate(() => window.clearGraphicsDraws());
  for (const type of ['pageshow', 'focus', 'pageshow', 'focus']) {
    await page.evaluate(event => window.dispatchEvent(new Event(event)), type);
  }
  await page.clock.runFor(1000);
  const stopped = await page.evaluate(() => window.graphicsProbe());
  expect(stopped.draws).toEqual([]);
  expect(Object.values(stopped.live).every(count => count === 0)).toBe(true);
});

for (const failure of ['createTexture', 'createFramebuffer', 'incompleteFramebuffer']) {
  test(`${failure} failure releases partial graphics and preserves content navigation`, async ({ page }) => {
    await observeGraphics(page);
    await page.addInitScript(mode => {
      if (mode === 'incompleteFramebuffer') WebGLRenderingContext.prototype.checkFramebufferStatus = () => 36054;
      else WebGLRenderingContext.prototype[mode] = () => null;
    }, failure);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?seed=0');
    const home = page.getByRole('region', { name: '继续浏览内容' });
    await expect(home).toBeVisible();
    await home.getByRole('link', { name: '关于我', exact: true }).click();
    await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
    const probe = await page.evaluate(() => window.graphicsProbe());
    expect(Object.values(probe.live).every(count => count === 0)).toBe(true);
    expect(probe.draws).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('a foreground allocation failure cleans subscriptions and explains unavailable games', async ({ page }, info) => {
  await observeGraphics(page);
  await page.addInitScript(() => {
    const buffer = WebGLRenderingContext.prototype.createBuffer;
    WebGLRenderingContext.prototype.createBuffer = function () {
      return document.querySelector('.celestial-gate') ? null : buffer.call(this);
    };
    // Observe browser resource lifetimes, with no production state or test hook.
    const targets = new Map(), signals = new Set();
    const observe = ResizeObserver.prototype.observe, disconnect = ResizeObserver.prototype.disconnect;
    ResizeObserver.prototype.observe = function (target, ...args) {
      if (!targets.has(this)) targets.set(this, new Set());
      targets.get(this).add(target); return observe.call(this, target, ...args);
    };
    ResizeObserver.prototype.disconnect = function () { targets.delete(this); return disconnect.call(this); };
    const listen = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (name, listener, options) {
      if (options?.signal && document.querySelector('.celestial-gate')) signals.add(options.signal);
      return listen.call(this, name, listener, options);
    };
    window.subscriptionProbe = () => ({ observers: [...targets.values()].reduce((sum, values) => sum + values.size, 0), liveSignals: [...signals].filter(signal => !signal.aborted).length });
  });
  const gameRequests = [], errors = [];
  page.on('request', request => { if (/space-game.*\.(js|css)/.test(request.url())) gameRequests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?seed=0');
  const home = page.getByRole('region', { name: '继续浏览内容' });
  await expect(home).toBeVisible();
  await expect(home.getByRole('link')).toHaveCount(4);
  await expect(page.locator('#shader-canvas')).toBeHidden();
  await home.getByRole('link', { name: '关于我', exact: true }).click();
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.subscriptionProbe())).toEqual({ observers: 0, liveSignals: 0 });
  expect(Object.values((await page.evaluate(() => window.graphicsProbe())).live).every(count => count === 0)).toBe(true);
  await page.keyboard.press('Shift+G');
  await expect(page.getByRole('dialog')).toContainText('当前图形功能不可用，暂时无法开始游戏');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.screenshot({ path: info.outputPath('foreground-fallback.png'), animations: 'disabled' });
  expect(gameRequests).toEqual([]); expect(errors).toEqual([]);
});
