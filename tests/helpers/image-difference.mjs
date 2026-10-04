import { PNG } from 'pngjs';

// Compare average channel intensity, allowing rasterization noise rather than
// requiring exact pixels or a golden screenshot of the artwork.
export function imageDifference(first, second) {
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  if (a.width !== b.width || a.height !== b.height) throw new Error('Image dimensions must match');
  let difference = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      difference += Math.abs(a.data[i + channel] - b.data[i + channel]);
    }
  }
  return difference / (a.width * a.height * 3);
}

