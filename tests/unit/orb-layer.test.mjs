import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrbLayer } from '../../src/features/scene/orb-layer.js';

function observeDrawing(getOrbs) {
  const draws = [], attributes = new Map();
  let upload, buffers = 0, programs = 0;
  const gl = {
    getUniformLocation: (_, name) => name,
    getAttribLocation: (_, name) => name,
    useProgram() {}, bindBuffer() {}, enableVertexAttribArray() {},
    disableVertexAttribArray() {}, uniform2f() {}, enable() {}, blendFunc() {},
    bufferData(_, data) { upload = { data: data.slice(), storage: data.buffer }; },
    vertexAttribPointer(name, size, type, normalized, stride, offset) {
      attributes.set(name, { size, stride, offset });
    },
    drawArrays(mode, first, count) { draws.push({ ...upload, first, count, attributes: new Map(attributes) }); },
  };
  const resources = {
    program() { programs++; return {}; },
    buffer() { buffers++; return {}; },
  };
  const layer = createOrbLayer(gl, resources, getOrbs);
  return { draws, draw: () => layer.draw({ cssWidth: 1280, cssHeight: 800, pixelRatio: 2 }),
    allocations: () => ({ buffers, programs }) };
}

function orb(x, particleCount = 0) {
  return {
    x, y: 200, size: 200, opacity: 1,
    appearance: {
      definition: {
        color: '#80c0ff', size: 200, haloRadius: 40, haloOpacity: .5, discRadius: 10, discOpacity: 1,
        particles: Array.from({ length: particleCount }, () => ({ radius: 20, size: 2, infalling: true })),
      },
      pose: {
        scale: 1, translateX: 0, pulseScale: 1, pulseOpacity: 1, particlesOpacity: 1,
        particles: Array.from({ length: particleCount }, () => ({ angle: 0, offset: 0, opacity: 1 })),
      },
    },
  };
}

function attribute(draw, name, vertex) {
  const { size, stride, offset } = draw.attributes.get(name);
  const start = (vertex * stride + offset) / Float32Array.BYTES_PER_ELEMENT;
  return [...draw.data.subarray(start, start + size)];
}

function assertCompleteUpload(draw) {
  for (const { size, stride, offset } of draw.attributes.values()) {
    assert.equal(draw.data.byteLength, draw.count * stride, 'every submitted vertex must have uploaded data');
    assert.ok(offset + size * Float32Array.BYTES_PER_ELEMENT <= stride);
  }
  assert.ok(draw.data.every(Number.isFinite));
}

test('orb batches grow beyond four orbs and 36 particles without dropping geometry', () => {
  let scene = [orb(100)];
  const drawing = observeDrawing(() => scene);
  drawing.draw();
  assertCompleteUpload(drawing.draws[0]);

  scene = Array.from({ length: 6 }, (_, index) => orb(100 + index * 150, 64));
  drawing.draw();
  const expanded = drawing.draws[1];
  assertCompleteUpload(expanded);
  assert.equal(expanded.count, 6 * (2 + 64 * 2) * 6);
  const lastQuadStart = attribute(expanded, 'position', expanded.count - 6);
  const lastQuadEnd = attribute(expanded, 'position', expanded.count - 1);
  assert.equal((lastQuadStart[0] + lastQuadEnd[0]) / 2, scene.at(-1).x + 20);
  assert.equal((lastQuadStart[1] + lastQuadEnd[1]) / 2, 200);

  scene = [orb(350)];
  drawing.draw();
  const smaller = drawing.draws[2];
  assertCompleteUpload(smaller);
  assert.equal(smaller.count, 12, 'a smaller frame must not submit stale geometry');
  assert.equal(smaller.storage, expanded.storage, 'retain the expanded allocation for reuse');
  assert.deepEqual(drawing.allocations(), { buffers: 1, programs: 1 });
});

test('the declared vertex layout decodes the orb geometry and appearance', () => {
  const drawing = observeDrawing(() => [orb(100)]);
  drawing.draw();
  const draw = drawing.draws[0];
  assertCompleteUpload(draw);
  assert.deepEqual(attribute(draw, 'position', 0), [60, 160]);
  assert.deepEqual(attribute(draw, 'local', 0), [-1, -1]);
  const color = attribute(draw, 'color', 0);
  for (const [index, expected] of [128 / 255, 192 / 255, 1, .5].entries()) {
    assert.ok(Math.abs(color[index] - expected) < 1e-6);
  }
  for (let vertex = 6; vertex < draw.count; vertex++) {
    const position = attribute(draw, 'position', vertex);
    const local = attribute(draw, 'local', vertex);
    assert.ok(Math.abs(position[0] - (100 + local[0] * 10)) < 1e-5);
    assert.ok(Math.abs(position[1] - (200 + local[1] * 10)) < 1e-5);
    assert.equal(attribute(draw, 'color', vertex)[3], 1);
  }
});
