import { drawnShipBox } from './game-drawing.js';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

// Inspect the browser's composed image, including the background and foreground.
// CSS-pixel screenshots keep the sampling regions independent of device density.
export async function sharedImage(page) {
  return PNG.sync.read(await page.screenshot({ scale: 'css' }));
}
export function colorPixels(image, color, region = { x: 0, y: 90, width: image.width, height: image.height - 90 }, tolerance = 6) {
  let count = 0;
  for (let y = Math.max(0, Math.ceil(region.y)); y < Math.min(image.height, region.y + region.height); y++) {
    for (let x = Math.max(0, Math.ceil(region.x)); x < Math.min(image.width, region.x + region.width); x++) {
      const i = (y * image.width + x) * 4;
      if (color.every((value, channel) => Math.abs(image.data[i + channel] - value) <= tolerance)) count++;
    }
  }
  return count;
}
// Scan a CSS-space region of a physical screenshot, including the pixel that
// contains its lower bound. Return CSS pixel centers; upper bounds stay exclusive.
// Unlike colorPixels (CSS screenshots, ceil start), density scans use floor start.
export function colorPoints(image, viewport, color, region, tolerance) {
  const ratio = image.width / viewport.width, points = [];
  for (let y = Math.max(0, Math.floor(region.y * ratio)); y < Math.min(image.height, (region.y + region.height) * ratio); y++) {
    for (let x = Math.max(0, Math.floor(region.x * ratio)); x < Math.min(image.width, (region.x + region.width) * ratio); x++) {
      const i = (y * image.width + x) * 4;
      if (color.every((value, channel) => Math.abs(image.data[i + channel] - value) <= tolerance)) points.push({ x: (x + .5) / ratio, y: (y + .5) / ratio });
    }
  }
  return points;
}
export async function canvasColorPixels(page, color, region) { return colorPixels(await sharedImage(page), color, region); }
export async function greenResourcePixels(page) { return canvasColorPixels(page, [120, 244, 196]); }
export async function forwardFanLanes(page) {
  const ship = await drawnShipBox(page), image = await sharedImage(page);
  const cx = ship.x + 13.2, cy = ship.y + 16.5;
  const lanes = new Set();
  for (let y = Math.ceil(cy - 210); y < cy - 40; y++) for (let x = Math.ceil(cx - 24); x < cx + 24; x++) {
    if (!colorPixels(image, [201, 245, 250], { x, y, width: 1, height: 1 })) continue;
    const dx = x - cx;
    if (dx < -4) lanes.add('left'); else if (dx > 4) lanes.add('right'); else if (Math.abs(dx) < 3) lanes.add('center');
  }
  return [...lanes].sort();
}

// Sample actual displayed frames at controlled clock boundaries. No drawing
// interception: a marker must survive final composition to enter the history.
export function observePickupMarkers(page) {
  const history = {};
  return { history, async runFor(milliseconds) {
    const motion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference');
    for (let elapsed = 0; elapsed < milliseconds;) {
      const pending = await page.evaluate(() => window.battleSnapshot);
      const nearDrop = pending?.obstacles.some(value => value.resource && !history[`drop:${value.resource}`]) || pending?.resources.some(value => !history[`drop:${value.kind}`]);
      const step = Math.min(nearDrop && motion === 'no-preference' ? 16 : 100, milliseconds - elapsed);
      await page.clock.runFor(step); elapsed += step;
      const state = await page.evaluate(() => window.battleSnapshot);
      if (!state || (!state.obstacles.some(value => value.resource && !history[`carrier:${value.resource}`]) && !state.resources.some(value => !history[`drop:${value.kind}`]))) continue;
      const image = await sharedImage(page);
      if (state) {
        const palette = { trajectory: [120,244,196], fireRate: [111,207,255], shockwave: [255,187,102], movement: [255,225,120], piercing: [210,167,255] };
        const header = await page.locator('.site-header').boundingBox();
        const record = (key, color, x, y, size) => {
          if (history[key]) return;
          const points = [];
          for (let py = Math.max(0, Math.ceil(y-size)); py < Math.min(image.height,y+size); py++) for (let px = Math.max(0,Math.ceil(x-size)); px < Math.min(image.width,x+size); px++) {
            const i = (py*image.width+px)*4;
            if (color.every((v,c) => Math.abs(image.data[i+c]-v) <= 6)) points.push([px,py]);
          }
          const extent = key.startsWith('carrier:') ? 5 : 7;
          // A tiny vertical piercing bolt must not stand in for a marker.
          if (points.length <= 10 || Math.max(...points.map(p => p[0]))-Math.min(...points.map(p => p[0])) < extent || Math.max(...points.map(p => p[1]))-Math.min(...points.map(p => p[1])) < extent) return;
          history[key] = true;
          if (process.env.GAME_EVIDENCE_DIR) writeFileSync(`${process.env.GAME_EVIDENCE_DIR}/${motion}-${key.replace(':', '-')}.png`, PNG.sync.write(image));
        };
        for (const obstacle of state.obstacles.filter(value => value.resource)) {
          const warning = obstacle.warning > 0;
          record(`carrier:${obstacle.resource}`, palette[obstacle.resource], warning ? Math.max(10, Math.min(image.width - 10, obstacle.x)) : obstacle.x,
            warning ? Math.max(header.y + header.height + 10, Math.min(image.height - 10, obstacle.y)) : obstacle.y, 12);
        }
        for (const resource of state.resources) record(`drop:${resource.kind}`, palette[resource.kind], resource.x, resource.y, 13);
      }

    }
  } };
}
