import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleLayer } from '../../src/features/work-games/battle-layer.js';

test('released lightning submits finite triangles at phone scale across pixel densities and subpixel positions', () => {
  for (const density of [.5, 1, 2, 3]) for (const offset of [0, .1, .5, .99]) {
    let vertices, drawn = 0;
    const gl = new Proxy({ NO_ERROR: 0, getError: () => 0,
      getAttribLocation: () => 0, getUniformLocation: () => 0,
      bufferSubData: (_target, _offset, data) => { vertices = [...data]; },
      drawArrays: (_mode, _first, count) => { drawn += count; },
    }, { get: (target, key) => key in target ? target[key] : () => {} });
    const state = { shockwaves: [], bullets: [], obstacles: [], particles: [],
      resources: [{ kind: 'fireRate', x: 390 + offset, y: 400 + offset }] };
    const layer = createBattleLayer(gl, { program: () => 0, buffer: () => 0 },
      () => ({ state, bounds: { left: 0, right: 780, top: 140, bottom: 1688 }, scale: .5 }));
    layer.draw({ width: 390 * density, height: 844 * density, cssWidth: 390, cssHeight: 844 });
    assert.ok(drawn > 0, `visible triangles at density ${density}, offset ${offset}`);
    assert.ok(vertices.every(Number.isFinite));
  }
});
