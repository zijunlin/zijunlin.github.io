import { PNG } from 'pngjs';

// Sample a thin ridge across an observed entrance trajectory. Symmetric pixels
// beside it cancel the smoothly varying background and halo without hiding them.
export function trailContrast(bytes, point, tangent, viewport) {
  const png = PNG.sync.read(bytes), ratio = png.width / viewport.width;
  const length = Math.hypot(tangent.x, tangent.y);
  const nx = -tangent.y / length, ny = tangent.x / length;
  const green = (x, y) => png.data[(Math.round(y * ratio) * png.width + Math.round(x * ratio)) * 4 + 1];
  const sample = offset => green(point.x + nx * offset, point.y + ny * offset);
  const beside = (sample(-3) + sample(3)) / 2;
  return Math.max(...[-1, -.5, 0, .5, 1].map(sample)) - beside;
}

export async function entranceCenters(page) {
  return page.locator('.celestial-gate').evaluateAll(links => links.map(link => {
    const box = link.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, size: box.width };
  }));
}

export function trajectorySample(history, index, orb) {
  const before = history[index - 1][orb], after = history[index + 1][orb];
  return { point: history[index][orb], tangent: { x: after.x - before.x, y: after.y - before.y } };
}

export function remapTrajectory(history, from, to) {
  return history.map(positions => positions.map(point => ({
    x: to.x + (point.x - from.x) / from.width * to.width,
    y: to.y + (point.y - from.y) / from.height * to.height,
    size: point.size,
  })));
}

export function discTrailSamples(bytes, center, history, orb, radius, viewport, fractions = [.25, .45, .65]) {
  // A local quadratic through three observed positions follows the curved
  // track within the disc, without importing the production orbital formula.
  const [older, previous, current] = history.slice(-3).map(points => points[orb]);
  const a = {}, b = {};
  for (const axis of ['x', 'y']) {
    a[axis] = (older[axis] - 2 * previous[axis] + current[axis]) / 2;
    b[axis] = previous[axis] - current[axis] - a[axis];
  }
  const offset = t => ({ x: a.x * t * t + b.x * t, y: a.y * t * t + b.y * t });
  return fractions.map(fraction => {
    let low = 0, high = 2;
    for (let i = 0; i < 16; i++) {
      const mid = (low + high) / 2, point = offset(mid);
      if (Math.hypot(point.x, point.y) < radius * fraction) low = mid; else high = mid;
    }
    const t = (low + high) / 2, delta = offset(t), tangent = { x: 2 * a.x * t + b.x, y: 2 * a.y * t + b.y };
    const sample = side => {
      const point = { x: center.x + side * delta.x, y: center.y + side * delta.y };
      return { point, ridge: trailContrast(bytes, point, tangent, viewport) };
    };
    return { fraction, trailing: sample(1), opposite: sample(-1) };
  });
}

export function discTrailContrast(bytes, center, history, orb, radius, viewport, fractions) {
  // Match positive radial halo curvature without turning a particle in the
  // opposite background sample into a false track on the trailing side.
  const contrasts = discTrailSamples(bytes, center, history, orb, radius, viewport, fractions)
    .map(({ trailing, opposite }) => trailing.ridge - Math.max(0, opposite.ridge));
  return contrasts.sort((a, b) => a - b)[Math.floor(contrasts.length / 2)];
}

// Integrate the narrow ridge and average along its tangent so subpixel placement
// does not turn a fade assertion into a comparison of two raster peak pixels.
export function trailStrength(bytes, point, tangent, viewport) {
  const png = PNG.sync.read(bytes), ratio = png.width / viewport.width;
  const length = Math.hypot(tangent.x, tangent.y), tx = tangent.x / length, ty = tangent.y / length;
  const sample = (along, across) => {
    const x = Math.round((point.x + tx * along - ty * across) * ratio);
    const y = Math.round((point.y + ty * along + tx * across) * ratio);
    return png.data[(y * png.width + x) * 4 + 1];
  };
  let strength = 0;
  for (const along of [-1, 0, 1]) {
    const background = (sample(along, -4) + sample(along, 4)) / 2;
    for (let across = -2; across <= 2; across += 1 / ratio) strength += (sample(along, across) - background) / ratio;
  }
  return strength / 3;
}

export function trailWidth(bytes, point, tangent, viewport) {
  const png = PNG.sync.read(bytes), ratio = png.width / viewport.width;
  const length = Math.hypot(tangent.x, tangent.y), nx = -tangent.y / length, ny = tangent.x / length;
  const sample = offset => {
    const x = Math.round((point.x + nx * offset) * ratio), y = Math.round((point.y + ny * offset) * ratio);
    return png.data[(y * png.width + x) * 4 + 1];
  };
  const background = (sample(-3) + sample(3)) / 2;
  const profile = Array.from({ length: 61 }, (_, i) => ({ at: (i - 30) / 10, value: sample((i - 30) / 10) - background }));
  const half = Math.max(...profile.map(point => point.value)) / 2;
  const ridge = profile.filter(point => point.value > half);
  return ridge.at(-1).at - ridge[0].at + .1;
}
