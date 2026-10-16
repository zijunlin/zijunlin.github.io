import { PNG } from 'pngjs';

// The sharp disc edge is visible independently of the softly varying background
// and halo. Read both sides of the actual rendered image around a semantic link.
export function discPixels(bytes, box, viewport) {
  const png = PNG.sync.read(bytes), ratio = png.width / viewport.width;
  const cx = (box.x + box.width / 2) * ratio, cy = (box.y + box.height / 2) * ratio;
  const green = (x, y) => png.data[(Math.round(y) * png.width + Math.round(x)) * 4 + 1];
  const edges = [-1, 1].map(sign => {
    let best = { contrast: -Infinity, radius: 0 };
    for (let r = Math.ceil(box.width * .035 * ratio); r < box.width * .12 * ratio; r++) {
      let contrast = 0;
      for (let y = -1; y <= 1; y++) contrast += green(cx + sign * (r - 1), cy + y) - green(cx + sign * (r + 1), cy + y);
      contrast /= 3;
      if (contrast > best.contrast) best = { contrast, radius: r / ratio };
    }
    return best;
  });
  return { edges, radius: (edges[0].radius + edges[1].radius) / 2 };
}

export function warmParticlePixels(bytes, box, viewport) {
  const png = PNG.sync.read(bytes), ratio = png.width / viewport.width;
  let count = 0;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  for (let y = Math.floor((cy - box.width * .28) * ratio); y < (cy + box.width * .28) * ratio; y++) {
    for (let x = Math.floor((cx - box.width * .28) * ratio); x < (cx + box.width * .28) * ratio; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] > png.data[i + 1] + 4 && png.data[i + 1] > png.data[i + 2] + 8) count++;
    }
  }
  return count;
}

export function haloBrightness(bytes, box, viewport) {
  const png = PNG.sync.read(bytes), ratio = png.width / viewport.width;
  const cx = (box.x + box.width / 2) * ratio, cy = (box.y + box.height / 2) * ratio;
  const sample = (inner, outer) => {
    let value = 0, count = 0;
    for (let y = Math.floor(cy - outer * box.width * ratio); y < cy + outer * box.width * ratio; y++) {
      for (let x = Math.floor(cx - outer * box.width * ratio); x < cx + outer * box.width * ratio; x++) {
        const radius = Math.hypot(x - cx, y - cy) / (box.width * ratio);
        if (radius < inner || radius > outer) continue;
        value += png.data[(y * png.width + x) * 4 + 1]; count++;
      }
    }
    return value / count;
  };
  return sample(.12, .20) - sample(.38, .42);
}

export function orbHorizontalShift(before, after, box, viewport) {
  const a = PNG.sync.read(before), b = PNG.sync.read(after), ratio = a.width / viewport.width;
  const cx = (box.x + box.width / 2) * ratio, cy = (box.y + box.height / 2) * ratio;
  let best = { shift: 0, error: Infinity };
  for (let shift = -4; shift <= 4; shift++) {
    let error = 0;
    for (let y = Math.round(cy - box.width * .07 * ratio); y <= cy + box.width * .07 * ratio; y++) {
      for (let x = Math.round(cx - box.width * .12 * ratio); x <= cx + box.width * .12 * ratio; x++) {
        const i = (y * a.width + x) * 4, j = (y * b.width + x + Math.round(shift * ratio)) * 4;
        for (let channel = 0; channel < 3; channel++) error += Math.abs(a.data[i + channel] - b.data[j + channel]);
      }
    }
    if (error < best.error) best = { shift, error };
  }
  return best.shift;
}
