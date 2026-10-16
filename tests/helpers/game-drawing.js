import { expect } from '@playwright/test';
import { PNG } from 'pngjs';

// Test-only browser-boundary observer: record commands actually submitted to
// WebGL. It never reads simulation state or creates a stand-in visual element.
// Screenshot checks below independently verify the submitted geometry is visible.
export function observeGameDrawing() {
  const methods = WebGLRenderingContext.prototype;
  const locations = new WeakMap(), programs = new WeakMap(), buffers = new WeakMap();
  const contexts = new WeakMap();
  const context = gl => { if (!contexts.has(gl)) contexts.set(gl, {}); return contexts.get(gl); };
  const values = program => { if (!programs.has(program)) programs.set(program, {}); return programs.get(program); };
  const hook = (name, wrapper) => { const original = methods[name]; methods[name] = function (...args) { return wrapper.call(this, original, args); }; };
  hook('getUniformLocation', function (original, args) {
    const location = original.apply(this, args);
    if (location) locations.set(location, { program: args[0], name: args[1] });
    return location;
  });
  for (const name of ['uniform1f', 'uniform2f']) hook(name, function (original, args) {
    const uniform = args[0] && locations.get(args[0]);
    if (uniform) values(uniform.program)[uniform.name] = args.slice(1);
    return original.apply(this, args);
  });
  hook('useProgram', function (original, args) { context(this).program = args[0]; return original.apply(this, args); });
  hook('bindBuffer', function (original, args) { if (args[0] === this.ARRAY_BUFFER) context(this).buffer = args[1]; return original.apply(this, args); });
  hook('bufferData', function (original, args) {
    if (args[0] === this.ARRAY_BUFFER && ArrayBuffer.isView(args[1])) buffers.set(context(this).buffer, args[1].slice());
    return original.apply(this, args);
  });
  window.gameDrawing = {};
  hook('drawArrays', function (original, args) {
    const result = original.apply(this, args), state = context(this), uniforms = values(state.program);
    if (uniforms.shipOrigin && uniforms.mask?.[0] === 0) {
      window.gameDrawing.ship = { x: uniforms.shipOrigin[0], y: uniforms.shipOrigin[1], scale: uniforms.worldScale[0], opacity: uniforms.opacity[0], at: performance.now() };
    }
    const data = buffers.get(state.buffer);
    if (data?.length === args[2] * 10) {
      const orbs = [];
      for (let i = 0; i < data.length; i += 60) {
        if (data[i + 8] !== 1 || Math.abs(data[i + 7] - .2275) > .0001) continue;
        const x = (data[i] + data[i + 10]) / 2, y = (data[i + 1] + data[i + 21]) / 2;
        orbs.push({ x, y, radius: (data[i + 10] - data[i]) / 2 });
      }
      if (orbs.length) window.gameDrawing.orbs = orbs;
    }
    return result;
  });
}

export async function drawnShipBox(page) {
  return page.evaluate(() => {
    const ship = window.gameDrawing?.ship;
    if (!ship) throw new Error('No native ship drawing was submitted');
    return { x: ship.x, y: ship.y, width: 26.4 * ship.scale, height: 39.6 * ship.scale };
  });
}

export async function shipScreenshot(page, options = {}) {
  const box = await drawnShipBox(page);
  return page.screenshot({ ...options, clip: { x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)),
    width: Math.ceil(box.width) + 1, height: Math.ceil(box.height) + 1 } });
}

export async function expectSatellites(page) {
  const orbs = await page.evaluate(() => window.gameDrawing?.orbs);
  expect(orbs, 'four actual orb discs submitted for the current picture').toHaveLength(4);
  const png = PNG.sync.read(await page.screenshot()), ratio = png.width / page.viewportSize().width;
  const green = (x, y) => png.data[(Math.round(y * ratio) * png.width + Math.round(x * ratio)) * 4 + 1];
  for (const [i, orb] of orbs.entries()) {
    // Compare across each sharp disc edge, avoiding the smooth halo/background.
    const contrasts = [-1, 1].map(sign => green(orb.x + sign * (orb.radius - 2), orb.y) - green(orb.x + sign * (orb.radius + 2), orb.y));
    expect(Math.max(...contrasts), `satellite ${i} is visible at its submitted location`).toBeGreaterThan(2);
  }
}
