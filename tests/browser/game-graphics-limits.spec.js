import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { observeGameDrawing, drawnShipBox } from '../helpers/game-drawing.js';

for (const hardwareLimit of [null, 1024]) {
  test.describe(`shared combat surface under ${hardwareLimit ?? 'total pixel budget'}`, () => {
    test.use({ viewport: { width: 2200, height: 1200 }, deviceScaleFactor: 2 });
    test('native combat obeys the shared surface budget without a source canvas or second context', async ({ page }, info) => {
      await page.addInitScript(observeGameDrawing);
      await page.addInitScript(limit => {
        const get = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (name) {
          return limit && name === this.MAX_TEXTURE_SIZE ? limit : get.call(this, name);
        };
        const context = HTMLCanvasElement.prototype.getContext;
        const contexts = new Set(); window.combatContexts = { twoD: 0, webgl: 0, uploads: 0 };
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          const result = context.call(this, kind, ...args);
          if (kind === '2d') window.combatContexts.twoD++;
          if (result && /^(webgl|experimental-webgl|webgl2)$/.test(kind)) { contexts.add(result); window.combatContexts.webgl = contexts.size; }
          return result;
        };
        for (const name of ['texImage2D', 'texSubImage2D']) {
          const upload = WebGLRenderingContext.prototype[name];
          WebGLRenderingContext.prototype[name] = function (...args) {
            if (args.at(-1) instanceof HTMLCanvasElement) window.combatContexts.uploads++;
            return upload.apply(this, args);
          };
        }
      }, hardwareLimit);
      const time = new Date('2026-10-14T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      await page.goto('/?seed=0'); await expect(page.locator('#world-entry')).toBeVisible();
      await page.keyboard.press('Shift+G'); await expect(page.locator('.space-game')).toBeVisible();
      await page.clock.runFor(3300);
      const sizes = await page.evaluate(() => {
        const surface = document.querySelector('#shader-canvas');
        return { width: surface.width, height: surface.height, canvases: document.querySelectorAll('canvas').length, ...window.combatContexts };
      });
      expect(sizes.width * sizes.height).toBeLessThanOrEqual(3840 * 2160);
      if (hardwareLimit) expect(Math.max(sizes.width, sizes.height)).toBeLessThanOrEqual(hardwareLimit);
      expect(sizes).toMatchObject({ canvases: 1, twoD: 0, webgl: 1, uploads: 0 });
      const box = await drawnShipBox(page);
      const png = PNG.sync.read(await page.screenshot({ clip: { x: Math.floor(box.x - 35), y: Math.floor(box.y - 170), width: 100, height: 130 }, path: info.outputPath('visible-combat.png') }));
      let bright = 0;
      for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > 150 && png.data[i + 1] > 190 && png.data[i + 2] > 190) bright++;
      expect(bright, 'actual composed projectile pixels remain visible above the ship').toBeGreaterThan(3);
    });
  });
}

test('failure of a native game buffer allocation returns to accessible content without leaked resources', async ({ page }) => {
  await page.addInitScript(() => {
    const live = new Set();
    for (const kind of ['Program', 'Buffer', 'Texture', 'Framebuffer']) {
      const create = WebGLRenderingContext.prototype[`create${kind}`], remove = WebGLRenderingContext.prototype[`delete${kind}`];
      WebGLRenderingContext.prototype[`create${kind}`] = function (...args) { const resource = create.apply(this, args); if (resource) live.add(resource); return resource; };
      WebGLRenderingContext.prototype[`delete${kind}`] = function (resource) { live.delete(resource); return remove.call(this, resource); };
    }
    let failed = false, armed = false;
    const allocate = WebGLRenderingContext.prototype.createBuffer;
    WebGLRenderingContext.prototype.createBuffer = function (...args) {
      if (armed && !failed) { failed = true; return null; }
      return allocate.apply(this, args);
    };
    window.failNextGameBuffer = () => { armed = true; };
    window.allocationProbe = () => ({ failed, remaining: live.size });
  });
  const time = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0'); await expect(page.locator('#world-entry')).toBeVisible();
  await page.evaluate(() => window.failNextGameBuffer());
  await page.keyboard.press('Shift+G');
  await expect(page.getByRole('region', { name: '继续浏览内容' })).toBeVisible({ timeout: 2000 });
  await expect(page.locator('.space-game')).toHaveCount(0);
  expect(await page.evaluate(() => window.allocationProbe())).toEqual({ failed: true, remaining: 0 });
  await expect(page.getByRole('dialog')).toContainText('当前图形功能不可用');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.getByRole('region', { name: '继续浏览内容' }).getByRole('link', { name: '关于我', exact: true }).click();
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
});
