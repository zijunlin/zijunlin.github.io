import test from 'node:test';
import assert from 'node:assert/strict';
import { pickupPresentation } from '../../src/features/work-games/pickup-presentation.js';
import { createBattleLayer } from '../../src/features/work-games/battle-layer.js';

for (const kind of Object.keys(pickupPresentation)) for (const phase of ['warning', 'carrier', 'released'])
test(`${kind} ${phase} submits finite triangles across scale, density and subpixel position`, () => {
  for (const scale of [.5, .75, 1]) for (const density of [.5, 1, 2, 3]) for (const offset of [0, .1, .5, .99]) {
    let vertices, drawn = 0;
    const gl = new Proxy({ NO_ERROR: 0, getError: () => 0,
      getAttribLocation: () => 0, getUniformLocation: () => 0,
      bufferSubData: (_target, _offset, data) => { vertices = [...data]; },
      drawArrays: (_mode, _first, count) => { drawn += count; },
    }, { get: (target, key) => key in target ? target[key] : () => {} });
    const state = { shockwaves: [], bullets: [], obstacles: [], particles: [],
      resources: [] };
    const position = { x: 390 + offset, y: 400 + offset };
    if (phase === 'released') state.resources.push({ kind, ...position });
    else state.obstacles.push({ ...position, resource: kind, radius: 20, warning: phase === 'warning' ? .4 : 0 });
    const layer = createBattleLayer(gl, { program: () => 0, buffer: () => 0 },
      () => ({ state, bounds: { left: 0, right: 780, top: 140, bottom: 1688 }, scale }));
    layer.draw({ width: 390 * density, height: 844 * density, cssWidth: 390, cssHeight: 844 });
    assert.ok(drawn > 0, `visible triangles at density ${density}, offset ${offset}`);
    assert.ok(vertices.every(Number.isFinite));
  }
});
