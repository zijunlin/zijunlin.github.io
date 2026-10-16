import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipLayer } from '../../src/features/work-games/ship-layer.js';
import { createBattleLayer } from '../../src/features/work-games/battle-layer.js';

function graphicsProbe() {
  let current, vertices;
  const draws = [], uniforms = new Map();
  const resources = Object.fromEntries(['program', 'buffer', 'texture', 'framebuffer'].map(name => [name, () => ({})]));
  const gl = new Proxy({
    NO_ERROR: 0, FRAMEBUFFER_COMPLETE: 1, getError: () => 0, checkFramebufferStatus: () => 1,
    getAttribLocation: () => 0, getUniformLocation: (program, name) => ({ program, name }),
    useProgram: program => { current = program; },
    uniform2f: ({ program, name }, x, y) => { if (!uniforms.has(program)) uniforms.set(program, {}); uniforms.get(program)[name] = [x, y]; },
    bufferSubData: (_target, _offset, data) => { vertices = [...data]; },
    drawArrays: (_mode, _first, count) => draws.push({ count, ...uniforms.get(current) }),
  }, { get: (target, name) => name in target ? target[name] : () => {} });
  return { gl, resources, draws, get vertices() { return vertices; } };
}

test('hull and glow snap original coordinates to each resized framebuffer without mutating the scene', () => {
  const probe = graphicsProbe(), ship = { x: 100.25, y: 200.49, scale: .5, opacity: 1 };
  const layer = createShipLayer(probe.gl, probe.resources, () => ship);
  for (const [width, height, cssWidth, cssHeight] of [[3840, 2160, 2560, 1440], [3455, 2399, 1729, 1201], [1280, 800, 1280, 800]]) {
    layer.draw({ width, height, cssWidth, cssHeight, pixelRatio: width / cssWidth });
    const expected = [Math.round(ship.x * width / cssWidth) / (width / cssWidth), Math.round(ship.y * height / cssHeight) / (height / cssHeight)];
    for (const draw of probe.draws.slice(-2)) assert.deepEqual(draw.shipOrigin, expected);
  }
  assert.deepEqual(ship, { x: 100.25, y: 200.49, scale: .5, opacity: 1 });
});

test('piercing shots submit one ordered quad with the original flat-ended dimensions in every direction', () => {
  for (const [vx, vy] of [[0, -520], [312, -416], [-520, 0], [0, 0]]) for (const density of [.5, 1, 2, 3]) {
    const probe = graphicsProbe(), bullet = { x: 100.25, y: 200.49, radius: 2, vx, vy, piercing: true };
    const state = { bullets: [{ ...bullet, piercing: false }, bullet, { ...bullet, piercing: false }], obstacles: [], resources: [], shockwaves: [], particles: [] };
    const layer = createBattleLayer(probe.gl, probe.resources, () => ({ state, scale: .5, bounds: { left: 0, right: 780, top: 0, bottom: 1688 } }));
    layer.draw({ width: 390 * density, height: 844 * density, cssWidth: 390, cssHeight: 844 });
    assert.equal(probe.draws.length, 1);
    assert.equal(probe.draws[0].count, 18);
    const vertices = probe.vertices;
    assert.ok(vertices.every(Number.isFinite));
    const speed = Math.hypot(vx, vy), dx = speed ? vx / speed : 0, dy = speed ? vy / speed : -1;
    for (let i = 6; i < 12; i++) {
      const v = vertices.slice(i * 11, (i + 1) * 11);
      assert.equal(v[8], -5); assert.equal(v[9], 1.5);
      assert.ok(Math.abs((v[0] - bullet.x) * dx + (v[1] - bullet.y) * dy - (v[6] - 2)) < 1e-4);
      assert.ok(Math.abs(-(v[0] - bullet.x) * dy + (v[1] - bullet.y) * dx - v[7]) < 1e-4);
    }
    assert.equal(vertices[8], 2); assert.equal(vertices[12 * 11 + 8], 2);
  }
});
