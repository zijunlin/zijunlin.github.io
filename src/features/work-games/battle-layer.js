import { drawPickupMarker } from './pickup-presentation.js';

const STRIDE = 11;
const colors = new Map();
function rgba(hex) {
  if (!colors.has(hex)) colors.set(hex, [1, 3, 5, 7].map((offset, i) => i === 3 && hex.length === 7 ? 1 : parseInt(hex.slice(offset, offset + 2), 16) / 255));
  return colors.get(hex);
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function segmentsMeet(a, b, c, d) {
  const epsilon = 1e-8;
  // Include touching and collinear overlap, but not disjoint collinear edges.
  if ([0, 1].some(axis => Math.max(a[axis], b[axis]) < Math.min(c[axis], d[axis]) - epsilon
    || Math.max(c[axis], d[axis]) < Math.min(a[axis], b[axis]) - epsilon)) return false;
  const side = value => Math.abs(value) <= epsilon ? 0 : Math.sign(value);
  return side(cross(a, b, c)) * side(cross(a, b, d)) <= 0
    && side(cross(c, d, a)) * side(cross(c, d, b)) <= 0;
}
function oriented(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return area < 0 ? [...points].reverse() : points;
}
function offsetPath(points, distance, closed = true) {
  const normal = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], length = Math.hypot(x, y); return [y / length, -x / length]; };
  return points.map((point, i) => {
    const before = normal(points[(i + points.length - 1) % points.length], point);
    const after = normal(point, points[(i + 1) % points.length]);
    if (!closed && i === 0) return [point[0] + after[0] * distance, point[1] + after[1] * distance];
    if (!closed && i === points.length - 1) return [point[0] + before[0] * distance, point[1] + before[1] * distance];
    const divisor = 1 + before[0] * after[0] + before[1] * after[1];
    return [point[0] + (before[0] + after[0]) * distance / divisor, point[1] + (before[1] + after[1]) * distance / divisor];
  });
}

// Offset corners can meet across a narrow concave notch. Reduce only the
// coverage inset until its boundary is simple; the actual outline never moves.
function safeInset(points, distance) {
  for (let attempt = 0; attempt < 16; attempt++, distance /= 2) {
    const inset = offsetPath(points, -distance);
    let valid = true;
    for (let i = 0; i < points.length && valid; i++) {
      const previous = (i + points.length - 1) % points.length, next = (i + 1) % points.length;
      if (cross(points[previous], points[i], points[next]) * cross(inset[previous], inset[i], inset[next]) <= 0) valid = false;
      for (let j = i + 2; j < points.length && valid; j++) {
        const end = (j + 1) % points.length;
        if (end === i) continue;
        if (segmentsMeet(inset[i], inset[next], inset[j], inset[end])) valid = false;
      }
    }
    if (valid) return inset;
  }
  return points;
}

// One ordered triangle stream owns all combat artwork. Geometry storage grows
// only when needed and is reused; no entity owns a GPU resource.
export function createBattleLayer(gl, resources, scene) {
  const program = resources.program(`
    attribute vec2 position; attribute vec4 color; attribute vec4 circle; attribute float coverage;
    uniform vec2 viewport; uniform float scale;
    varying vec4 ink; varying vec4 radial; varying float edge;
    void main() {
      gl_Position = vec4(position * scale / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
      ink = color; radial = circle; edge = coverage;
    }`, `
    precision highp float;
    varying vec4 ink; varying vec4 radial; varying float edge;
    uniform float feather;
    void main() {
      float alpha = edge;
      if (radial.z > 0.) {
        float distance = length(radial.xy);
        alpha = clamp((radial.z - distance) / feather + .5, 0., 1.);
        if (radial.w >= 0.) alpha *= clamp((distance - radial.w) / feather + .5, 0., 1.);
      }
      if (radial.z < 0.) {
        vec2 halfSize = vec2(-radial.z, radial.w);
        vec2 extent = clamp((halfSize - radial.xy) / feather + .5, 0., 1.) - clamp((-halfSize - radial.xy) / feather + .5, 0., 1.);
        alpha = extent.x * extent.y;
      }
      gl_FragColor = vec4(ink.rgb, ink.a * alpha);
    }`);
  const buffer = resources.buffer();
  const attributes = [['position', 2, 0], ['color', 4, 2], ['circle', 4, 6], ['coverage', 1, 10]]
    .map(([name, size, offset]) => [gl.getAttribLocation(program, name), size, offset]);
  const viewport = gl.getUniformLocation(program, 'viewport'), worldScale = gl.getUniformLocation(program, 'scale'), featherUniform = gl.getUniformLocation(program, 'feather');
  let data = new Float32Array(STRIDE * 4096), used = 0, feather = 1, allocated = 0;
  function vertex(point, color, coverage = 1, circle = [0, 0, 0, -1]) {
    if (used + STRIDE > data.length) { const next = new Float32Array(data.length * 2); next.set(data); data = next; }
    data.set(point, used); data.set(color, used + 2); data.set(circle, used + 6); data[used + 10] = coverage; used += STRIDE;
  }
  function triangle(a, b, c, color) { vertex(a, color); vertex(b, color); vertex(c, color); }
  function interior(points, color) {
    const remaining = points.map((_, index) => index);
    while (remaining.length > 3) {
      let clipped = false;
      for (let j = 0; j < remaining.length; j++) {
        const a = points[remaining[(j + remaining.length - 1) % remaining.length]], b = points[remaining[j]], c = points[remaining[(j + 1) % remaining.length]];
        if (cross(a, b, c) <= 0) continue;
        if (remaining.some((index, k) => k !== j && k !== (j + 1) % remaining.length && k !== (j + remaining.length - 1) % remaining.length
          && cross(a, b, points[index]) >= 0 && cross(b, c, points[index]) >= 0 && cross(c, a, points[index]) >= 0)) continue;
        triangle(a, b, c, color); remaining.splice(j, 1); clipped = true; break;
      }
      if (!clipped) throw new Error('Invalid combat polygon');
    }
    triangle(...remaining.map(index => points[index]), color);
  }
  function band(inner, outer, color, innerCoverage = 1, outerCoverage = 1) {
    for (let i = 0; i < inner.length; i++) {
      const next = (i + 1) % inner.length;
      vertex(inner[i], color, innerCoverage); vertex(outer[i], color, outerCoverage); vertex(outer[next], color, outerCoverage);
      vertex(inner[i], color, innerCoverage); vertex(outer[next], color, outerCoverage); vertex(inner[next], color, innerCoverage);
    }
  }
  function fill(points, hex, alpha = 1, inset = feather / 2) {
    points = oriented(points);
    const color = [...rgba(hex)]; color[3] *= alpha;
    // Keep the filled core valid even when a marker is smaller than one
    // framebuffer pixel; concave notches must not invert during AA inset.
    const shortest = Math.min(...points.map((p, i) => Math.hypot(p[0] - points[(i + 1) % points.length][0], p[1] - points[(i + 1) % points.length][1])));
    inset = Math.min(inset, shortest * .2);
    const inside = safeInset(points, inset), outside = offsetPath(points, feather / 2);
    interior(inside, color); band(inside, outside, color, 1, 0);
  }
  function stroke(points, hex, width, closed = false) {
    points = points.filter((point, i) => !i || Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) > 1e-8);
    if (points.length < 2) return;
    if (!closed) {
      const outline = [...offsetPath(points, width / 2, false), ...offsetPath(points, -width / 2, false).reverse()];
      fill(outline, hex, Math.min(1, width / feather), Math.min(feather / 2, width * .45));
      return;
    }
    points = oriented(points);
    const color = [...rgba(hex)]; color[3] *= Math.min(1, width / feather);
    const core = Math.max(width / 2 - feather / 2, width * .05);
    const inner = offsetPath(points, -core), outer = offsetPath(points, core);
    band(inner, outer, color);
    band(outer, offsetPath(points, width / 2 + feather / 2), color, 1, 0);
    band(offsetPath(points, -width / 2 - feather / 2), inner, color, 0, 1);
  }
  function circle(x, y, radius, hex, width = 0) {
    const outer = radius + width / 2, inner = width ? Math.max(0, radius - width / 2) : -1, extent = outer + feather;
    const corners = [[-extent, -extent], [extent, -extent], [extent, extent], [-extent, extent]];
    for (const i of [0, 1, 2, 0, 2, 3]) { const [dx, dy] = corners[i]; vertex([x + dx, y + dy], rgba(hex), 1, [dx, dy, outer, inner]); }
  }
  function particleSquare(particle) {
    const extent = 1 + feather / 2, color = [...rgba('#ffd39b')];
    color[3] = Math.min(1, particle.life / .45);
    const corners = [[-extent, -extent], [extent, -extent], [extent, extent], [-extent, extent]];
    for (const i of [0, 1, 2, 0, 2, 3]) { const [dx, dy] = corners[i]; vertex([particle.x + dx, particle.y + dy], color, 1, [dx, dy, -1, 1]); }
  }
  function piercingShot(bullet) {
    const speed = Math.hypot(bullet.vx, bullet.vy), dx = speed ? bullet.vx / speed : 0, dy = speed ? bullet.vy / speed : -1;
    // Flat-ended 10 × 3 rectangle, centered two units behind the projectile.
    // Signed half-length selects analytic rectangular coverage, also used by
    // particles. Keep this quad in the original stream to preserve draw order.
    const length = 5 + feather / 2, width = 1.5 + feather / 2;
    const corners = [[-length, -width], [length, -width], [length, width], [-length, width]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [along, across] = corners[i];
      vertex([bullet.x + dx * (along - 2) - dy * across, bullet.y + dy * (along - 2) + dx * across],
        rgba('#d2a7ff'), 1, [along, across, -5, 1.5]);
    }
  }
  const painter = { fill, stroke, circle };
  function artwork(state, bounds) {
    for (const wave of state.shockwaves) circle(wave.x, wave.y, wave.radius, '#9be8ff', 3);
    for (const bullet of state.bullets) {
      if (!bullet.piercing) { circle(bullet.x, bullet.y, bullet.radius, '#c9f5fa'); continue; }
      piercingShot(bullet);
    }
    for (const obstacle of state.obstacles) {
      if (obstacle.warning > 0) {
        const x = Math.max(bounds.left + 10, Math.min(bounds.right - 10, obstacle.x)), y = Math.max(bounds.top + 10, Math.min(bounds.bottom - 10, obstacle.y));
        circle(x, y, 7 + (1 - obstacle.warning / .65) * 8, obstacle.fast ? '#fff07a' : '#f4c880', obstacle.fast ? 3 : 2);
        if (obstacle.resource) drawPickupMarker(painter, obstacle.resource, x, y, 6);
        continue;
      }
      if (obstacle.fast) {
        const speed = Math.hypot(obstacle.vx, obstacle.vy), dx = speed ? obstacle.vx / speed : 0, dy = speed ? obstacle.vy / speed : 0;
        for (const side of [-1, 1]) {
          const x = obstacle.x - dx * obstacle.radius * .6 - dy * side * obstacle.radius * .45, y = obstacle.y - dy * obstacle.radius * .6 + dx * side * obstacle.radius * .45;
          if (speed) stroke([[x, y], [x - dx * 18, y - dy * 18]], '#fff07a', 2);
        }
      }
      const points = Array.from({ length: 9 }, (_, i) => { const angle = i * Math.PI * 2 / 9, radius = obstacle.radius * (i % 2 ? .85 : 1); return [obstacle.x + Math.cos(angle) * radius, obstacle.y + Math.sin(angle) * radius]; });
      fill(points, obstacle.flash ? '#fff5d7' : '#765d59aa');
      stroke(points, obstacle.fast ? '#fff07a' : '#dfa796', obstacle.fast ? 3 : 1.5, true);
      if (obstacle.resource) drawPickupMarker(painter, obstacle.resource, obstacle.x, obstacle.y, 7);
    }
    for (const resource of state.resources) drawPickupMarker(painter, resource.kind, resource.x, resource.y, 10);
    for (const particle of state.particles) particleSquare(particle);
  }
  return { draw(frame) {
    const current = scene();
    if (!current) return;
    const { state, bounds, scale } = current;
    feather = 1 / (Math.min(frame.width / frame.cssWidth, frame.height / frame.cssHeight) * scale);
    used = 0; artwork(state, bounds);
    if (!used) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, frame.width, frame.height);
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (allocated < data.byteLength) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); allocated = data.byteLength; if (gl.getError() !== gl.NO_ERROR) throw new Error('Combat buffer allocation failed'); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, used));
    gl.uniform2f(viewport, frame.cssWidth, frame.cssHeight); gl.uniform1f(worldScale, scale); gl.uniform1f(featherUniform, feather);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const xRatio = frame.width / frame.cssWidth * scale, yRatio = frame.height / frame.cssHeight * scale;
    const left = Math.max(0, Math.ceil(bounds.left * xRatio)), right = Math.min(frame.width, Math.floor(bounds.right * xRatio));
    const top = Math.max(0, Math.ceil(bounds.top * yRatio)), bottom = Math.min(frame.height, Math.floor(bounds.bottom * yRatio));
    gl.enable(gl.SCISSOR_TEST); gl.scissor(left, frame.height - bottom, Math.max(0, right - left), Math.max(0, bottom - top));
    try {
      for (const [location, size, offset] of attributes) { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4); }
      gl.drawArrays(gl.TRIANGLES, 0, used / STRIDE);
    } finally { gl.disable(gl.SCISSOR_TEST); for (const [location] of attributes) gl.disableVertexAttribArray(location); }
  } };
}
