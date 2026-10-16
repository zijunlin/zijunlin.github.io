import { advanceUntil } from '../helpers/game-scenario.js';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { entranceCenters, trajectorySample, trailContrast } from '../helpers/trail-pixels.js';
import { imageDifference } from '../helpers/image-difference.mjs';
import { observeGameDrawing, drawnShipBox, shipScreenshot, expectSatellites } from '../helpers/game-drawing.js';

test.use({ reducedMotion: 'reduce' });
test.setTimeout(90000);
async function lose(page) {
  await page.locator('#shader-canvas').evaluate(canvas => {
    window.loss = canvas.getContext('webgl').getExtension('WEBGL_lose_context');
    if (!window.loss) throw new Error('Real context-loss extension unavailable');
    window.loss.loseContext();
  });
  await expect(page.locator('#shader-canvas')).toBeHidden();
}
async function restore(page) {
  await page.evaluate(() => window.loss.restoreContext());
  await expect(page.locator('#shader-canvas')).toBeVisible();
}
async function enter(page, opening = false, beforeGame) {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await beforeGame?.();
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
  if (opening) return;
  await page.clock.runFor(3300);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
}
test('real context recovery preserves battle time and waits for explicit resume', async ({ page }, info) => {
  await page.addInitScript(observeGameDrawing);
  await enter(page);
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(100);
  const score = await page.locator('.game-score').textContent();
  const position = await drawnShipBox(page);
  const before = await shipScreenshot(page, { path: info.outputPath('ship-before.png') });
  await lose(page);
  await expect(page.getByRole('dialog')).toContainText('正在恢复图形');
  await page.clock.runFor(2000);
  await expect(page.locator('.game-score')).toHaveText(score);
  await restore(page);
  expect(await drawnShipBox(page)).toEqual(position);
  const restored = await shipScreenshot(page, { path: info.outputPath('ship-restored.png'), style: 'dialog::backdrop { background: transparent !important; }' });
  expect(imageDifference(before, restored), 'actual cockpit, hull and glow survive resource recreation').toBeLessThan(1);
  await expectSatellites(page);
  await expect(page.getByRole('button', { name: '继续游戏', exact: true })).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator('.game-score')).toHaveText(score);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(300);
  await expect(page.locator('.game-score')).not.toHaveText(score);
  expect((await drawnShipBox(page)).x, 'the held pre-loss key was discarded').toBe(position.x);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(200);
  await page.keyboard.up('ArrowRight');
  expect((await drawnShipBox(page)).x).toBeGreaterThan(position.x + 60);
  await shipScreenshot(page, { path: info.outputPath('ship-moved.png') });
});

test('a loss while the home view is loading can recover into visible content', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route(/world-view.*\.js/, async route => { await pending; await route.continue(); });
  await page.goto('/?seed=0');
  await expect(page.locator('#shader-canvas')).toBeVisible();
  await lose(page);
  const loaded = page.waitForResponse(/world-view.*\.js/);
  release();
  await loaded;
  // Let the real module loader settle independently of the paused game clock.
  await new Promise(resolve => setTimeout(resolve, 100));
  await restore(page);
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await page.clock.runFor(100);
  await page.locator('.celestial-gate').first().click();
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
});

test('real loss before the loss event during game allocation still permits recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const create = WebGLRenderingContext.prototype.createBuffer;
    let triggered = false;
    WebGLRenderingContext.prototype.createBuffer = function () {
      if (!triggered && document.querySelector('.scene-heading')?.style.visibility === 'hidden') {
        triggered = true;
        window.loss = this.getExtension('WEBGL_lose_context');
        window.loss.loseContext();
      }
      return create.call(this);
    };
  });
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await page.keyboard.press('Shift+G');
  await expect(page.locator('#shader-canvas')).toBeHidden();
  await expect(page.locator('.space-game')).toHaveCount(0);
  await restore(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3300);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
});

test('home recovery freezes pointer parallax and restores the visible scene at the same phase', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.goto('/?seed=4');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await page.locator('#world-entry').screenshot({ animations: 'disabled' });
  await page.mouse.move(10, 780);
  const history = [await entranceCenters(page)];
  for (let i = 0; i < 4; i++) { await page.clock.runFor(1500); history.push(await entranceCenters(page)); }
  const stage = await page.locator('.celestial-stage').boundingBox();
  const before = await page.locator('#shader-canvas').screenshot({ path: info.outputPath('home-before.png') });
  await lose(page);
  await page.mouse.move(1200, 100);
  await page.clock.runFor(1000);
  expect(await page.locator('.celestial-stage').boundingBox()).toEqual(stage);
  await restore(page);
  const after = await page.locator('#shader-canvas').screenshot({ path: info.outputPath('home-restored.png') });
  expect(imageDifference(before, after), 'background, trails, discs and glow retain their frozen phase').toBeLessThan(.5);
  const { point, tangent } = trajectorySample(history, 1, 0);
  for (const pixels of [before, after]) expect(trailContrast(pixels, point, tangent, page.viewportSize()), 'the travelled trail is visible before and after resource recreation').toBeGreaterThan(3);
  await page.locator('.celestial-gate').first().click();
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
});

test('cancelled recovery notice stays closed after the recovery deadline', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await lose(page);
  await page.keyboard.press('Shift+G');
  await expect(page.getByRole('dialog')).toContainText('正在恢复图形');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(8100);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('region', { name: '继续浏览内容' }).getByRole('link', { name: '关于我', exact: true }).click();
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
});

async function observeRecoveryResources(page) {
  await page.addInitScript(() => {
    const contexts = new Set(), live = new Map();
    let invalidated = 0, deletes = 0, draws = 0;
    const frames = new Set();
    // Install after Playwright's page clock so it cannot replace this observer.
    window.observeRecoveryFrames = () => {
      const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
      window.requestAnimationFrame = callback => {
        const id = request.call(window, now => { frames.delete(id); callback(now); });
        frames.add(id); return id;
      };
      window.cancelAnimationFrame = id => { frames.delete(id); return cancel.call(window, id); };
      window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus'));
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = getContext.apply(this, args);
      if (args[0] === 'webgl' && gl && !contexts.has(gl)) {
        contexts.add(gl);
        this.addEventListener('webglcontextlost', () => {
          // Loss itself invalidates GPU objects. Do not mistake delete calls on
          // those invalid handles for independently measured GPU reclamation.
          for (const values of live.values()) { invalidated += values.size; values.clear(); }
        });
      }
      return gl;
    };
    for (const kind of ['Shader', 'Program', 'Buffer', 'Texture', 'Framebuffer']) {
      const values = new Set(); live.set(kind, values);
      for (const operation of ['create', 'delete']) {
        const name = operation + kind, original = WebGLRenderingContext.prototype[name];
        WebGLRenderingContext.prototype[name] = function (...args) {
          const result = original.apply(this, args);
          if (operation === 'create' && result) values.add(result);
          if (operation === 'delete') { deletes++; values.delete(args[0]); }
          return result;
        };
      }
    }
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) { draws++; return draw.apply(this, args); };
    window.recoveryResources = () => ({ contexts: contexts.size, invalidated, deletes, draws, pendingFrames: frames.size,
      live: Object.fromEntries([...live].map(([kind, values]) => [kind, values.size])) });
  });
}

test('opening, results and returning survive repeated real losses without reviving an ended battle', async ({ page }, info) => {
  await observeRecoveryResources(page);
  let homeBaseline;
  await enter(page, true, async () => { homeBaseline = await page.evaluate(() => window.recoveryResources()); });
  await page.clock.runFor(1600);
  const initial = await page.evaluate(() => window.recoveryResources());
  const observations = [initial];
  for (const phase of ['opening', 'results', 'returning']) {
    if (phase === 'results') {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: '本局结束' })).toBeVisible();
    }
    if (phase === 'returning') await page.getByRole('button', { name: '返回首页', exact: true }).click();
    const score = await page.locator('.game-score').textContent();
    await lose(page);
    await page.clock.runFor(1200);
    await expect(page.locator('.space-game')).toBeVisible();
    await expect(page.locator('.game-score')).toHaveText(score);
    await restore(page);
    const recovered = await page.evaluate(() => window.recoveryResources());
    expect(recovered.contexts).toBe(1);
    expect(recovered.live).toEqual(initial.live);
    observations.push(recovered);
    await page.clock.runFor(1000);
    await expect(page.locator('.game-score')).toHaveText(score);
    if (phase === 'results') {
      await expect(page.getByRole('button', { name: '继续游戏', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '再来一局', exact: true })).toBeVisible();
    } else {
      await page.getByRole('button', { name: '继续游戏', exact: true }).click();
      await page.clock.runFor(phase === 'opening' ? 1900 : 400);
    }
  }
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
  const home = await page.evaluate(() => window.recoveryResources());
  expect(home.contexts).toBe(1);
  expect(home.live).toEqual(homeBaseline.live);
  observations.push(home);
  await info.attach('resource-lifetimes', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
});

for (const failure of ['timeout', 'allocation', 'buffer-allocation', 'lost-again']) {
  test(`${failure} terminates recovery and leaves static navigation accessible`, async ({ page }, info) => {
    await observeRecoveryResources(page);
    await enter(page);
    await lose(page);
    if (failure === 'timeout') await page.clock.runFor(8100);
    else {
      await page.evaluate(mode => {
        const method = mode === 'buffer-allocation' ? 'createBuffer' : 'createTexture';
        const original = WebGLRenderingContext.prototype[method];
        WebGLRenderingContext.prototype[method] = function () {
          if (mode === 'lost-again') window.loss.loseContext();
          else return null;
          return original.call(this);
        };
        window.loss.restoreContext();
      }, failure);
    }
    await expect(page.getByRole('dialog')).toContainText('当前图形功能不可用');
    await expect(page.locator('.space-game')).toHaveCount(0);
    await page.getByRole('button', { name: '返回首页', exact: true }).click();
    const home = page.getByRole('region', { name: '继续浏览内容' });
    await expect(home.getByRole('link')).toHaveCount(4);
    const stopped = await page.evaluate(() => window.recoveryResources());
    expect(Object.values(stopped.live).every(count => count === 0)).toBe(true);
    // Late restoration and focus cannot restart drawing or revive a game.
    await page.evaluate(() => { window.loss.restoreContext(); window.dispatchEvent(new Event('focus')); });
    await page.clock.runFor(1000);
    await expect(page.locator('#shader-canvas')).toBeHidden();
    expect((await page.evaluate(() => window.recoveryResources())).draws).toBe(stopped.draws);
    await home.getByRole('link', { name: '关于我', exact: true }).click();
    await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+G');
    await expect(page.getByRole('dialog')).toContainText('当前图形功能不可用');
    await page.screenshot({ path: info.outputPath(`${failure}-static.png`) });
  });
}

test('navigation during recovery removes the game and cannot revive it after restoration', async ({ page }) => {
  await enter(page);
  await lose(page);
  await page.evaluate(() => { location.hash = '#about'; });
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
  await restore(page);
  await page.clock.runFor(1000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
});

test('loss cancels an in-flight game import instead of starting it on restoration', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  let release, requested;
  const pending = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { requested = resolve; });
  await page.route(/space-game.*\.js/, async route => { requested(); await pending; await route.continue(); });
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await page.keyboard.press('Shift+G');
  await request;
  await lose(page);
  await restore(page);
  release();
  await new Promise(resolve => setTimeout(resolve, 100));
  await page.clock.runFor(11000);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await page.keyboard.press('Shift+G');
  await expect(page.locator('.space-game')).toBeVisible();
});

test.describe('phone input after recovery', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  test('a captured drag is discarded and a new gesture works after resume', async ({ page }, info) => {
    await page.addInitScript(observeGameDrawing);
    await enter(page);
    await page.mouse.move(195, 650); await page.mouse.down();
    await page.mouse.move(225, 610); await page.clock.runFor(100);
    const before = await drawnShipBox(page);
    await lose(page);
    await page.mouse.move(300, 500); await page.mouse.up();
    await restore(page);
    await page.getByRole('button', { name: '继续游戏', exact: true }).tap();
    await page.clock.runFor(100);
    expect(await drawnShipBox(page)).toEqual(before);
    await page.mouse.move(195, 650); await page.mouse.down();
    await page.mouse.move(235, 600); await page.clock.runFor(400); await page.mouse.up();
    const moved = await drawnShipBox(page);
    expect(moved.x).toBeGreaterThan(before.x + 30);
    expect(moved.y).toBeLessThan(before.y - 40);
    await shipScreenshot(page, { path: info.outputPath('phone-restored-drag.png') });
  });
});

// Only the temporary dialog occlusion is removed for the screenshot; these are
// the actual final shared-surface pixels, never a separate combat rendering.
async function combatMask(page, info, name) {
  const image = PNG.sync.read(await page.screenshot({ scale: 'css', path: info.outputPath(`${name}.png`),
    style: 'dialog { visibility: hidden !important; } dialog::backdrop { background: transparent !important; }' }));
  const colors = { shots: [201, 245, 250], wave: [155, 232, 255] };
  return Object.fromEntries(Object.entries(colors).map(([kind, color]) => {
    const points = [];
    // The lower-middle arena avoids header/HUD text and the center dialog.
    for (let y = 480; y < image.height - 65; y++) for (let x = 350; x < image.width - 350; x++) {
      const i = (y * image.width + x) * 4;
      if (color.every((v, c) => Math.abs(image.data[i + c] - v) <= 6)) points.push(y * image.width + x);
    }
    return [kind, points];
  }));
}
function expectFrozenCombat(before, after) {
  for (const kind of ['shots', 'wave']) {
    expect(before[kind].length, `visible ${kind} before losing context`).toBeGreaterThan(20);
    const restored = new Set(after[kind]);
    const common = before[kind].filter(point => restored.has(point)).length;
    expect(common / Math.max(before[kind].length, after[kind].length), `${kind} retain their actual pixel locations`).toBeGreaterThan(.98);
  }
}
for (const phase of ['battle', 'paused', 'results']) {
  test(`${phase} combat pixels survive reconstruction and remain frozen until public continuation`, async ({ page }, info) => {
    await page.addInitScript(() => { Math.random = () => .1; });
    await enter(page);
    await page.clock.runFor(350);
    await page.keyboard.press('Space'); await page.clock.runFor(180);
    if (phase === 'paused') await page.keyboard.press('p');
    if (phase === 'results') await page.keyboard.press('Escape');
    const score = await page.locator('.game-score').textContent();
    const before = await combatMask(page, info, `${phase}-before`);
    await lose(page); await page.clock.runFor(1000);
    await expect(page.locator('.game-score')).toHaveText(score);
    await restore(page);
    expectFrozenCombat(before, await combatMask(page, info, `${phase}-restored`));
    await page.clock.runFor(1000);
    await expect(page.locator('.game-score')).toHaveText(score);
    expectFrozenCombat(before, await combatMask(page, info, `${phase}-still-frozen`));
    if (phase === 'results') {
      await expect(page.getByRole('button', { name: '继续游戏', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: '再来一局', exact: true }).click();
      await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
      await expect(page.locator('.game-score')).toContainText('存活: 0.0s');
    } else await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await page.clock.runFor(400);
    const continued = await combatMask(page, info, `${phase}-continued`);
    expect(continued.shots.length, 'new frames still contain visible shots').toBeGreaterThan(20);
    expect(continued.wave.length, 'old frozen wave is gone after continuation or replay').toBe(0);
    await expect(page.locator('.game-score')).not.toHaveText(score);
  });
}


for (const motion of ['reduce', 'no-preference']) {
test.describe(`combat cleanup ${motion}`, () => {
  test.use({ reducedMotion: motion });
test('returning and cancelled recoveries remove combat and repeated entries own one frame chain', async ({ page }, info) => {
  await observeRecoveryResources(page);
  await page.addInitScript(() => { Math.random = () => .1; });
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await page.bringToFront();
  await page.evaluate(() => window.observeRecoveryFrames());
  await page.clock.runFor(100);
  const home = await page.evaluate(() => window.recoveryResources());
  expect(home.pendingFrames).toBe(1);
  let battleResources;
  const observations = [home];
  for (const exit of ['returning', 'recovery-cancel', 'navigation-cancel']) {
    await page.keyboard.press('Shift+G');
    await expect(page.locator('.space-game')).toBeVisible();
    expect((await combatMask(page, info, `${exit}-opening`)).shots).toHaveLength(0);
    await page.clock.runFor(3650);
    await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
    await page.keyboard.press('Space'); await page.clock.runFor(180);
    const combat = await combatMask(page, info, `${exit}-battle`);
    expect(combat.shots.length).toBeGreaterThan(20);
    expect(combat.wave.length).toBeGreaterThan(20);
    const active = await page.evaluate(() => window.recoveryResources());
    battleResources ??= active.live;
    expect(active.live).toEqual(battleResources);
    expect(active.contexts).toBe(1); expect(active.pendingFrames).toBe(1);
    if (exit === 'returning') {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '返回首页', exact: true }).click();
      const returning = await combatMask(page, info, 'returning-cleared');
      expect(returning.shots).toHaveLength(0); expect(returning.wave).toHaveLength(0);
    }
    await lose(page);
    expect((await page.evaluate(() => window.recoveryResources())).pendingFrames).toBe(0);
    if (exit === 'recovery-cancel') await page.getByRole('button', { name: '返回首页', exact: true }).click();
    if (exit === 'navigation-cancel') {
      await page.evaluate(() => { location.hash = '#about'; });
      await expect(page.getByRole('region', { name: '关于我', exact: true })).toBeVisible();
    }
    await restore(page);
    const restored = await combatMask(page, info, `${exit}-restored`);
    expect(restored.shots).toHaveLength(0); expect(restored.wave).toHaveLength(0);
    if (exit === 'returning') {
      await page.getByRole('button', { name: '继续游戏', exact: true }).click();
      await page.clock.runFor(400);
    }
    if (exit === 'navigation-cancel') await page.keyboard.press('Escape');
    await advanceUntil(page, async () => await page.locator('.space-game').count() === 0,
      { timeout:3000, step:100, description:'public return animation completion' });
    await expect(page.locator('.space-game')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.celestial-gate').first()).toBeVisible();
    const released = await page.evaluate(() => window.recoveryResources());
    expect(released.live).toEqual(home.live);
    expect(released.contexts).toBe(1); expect(released.pendingFrames).toBe(1);
    observations.push(active, released);
  }
  await info.attach('combat-resource-cycles', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
});

});
}
