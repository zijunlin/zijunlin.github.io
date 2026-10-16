import { colorPixels } from '../helpers/game-canvas.js';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { startCombat } from '../helpers/combat-scenario.js';

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
test.setTimeout(120000);
async function start(page, random = "purpose => purpose === 'type' ? .99 : purpose === 'position' ? .3 : .5") {
  await startCombat(page, { random });
}
const snapshot = page => page.evaluate(() => window.battleSnapshot);
async function image(page, info, name) { return PNG.sync.read(await page.screenshot({ path: info.outputPath(`${name}.png`), scale: 'css' })); }
const count = (image, color, box) => colorPixels(image, color, box, 12);
const center = (o, size = 10) => ({ x: o.x - size, y: o.y - size, width: size * 2, height: size * 2 });

test('a surviving obstacle flashes pale on a real hit and returns to its translucent fill', async ({ page }, info) => {
  await start(page);
  await page.clock.runFor(2200);
  await page.keyboard.down('ArrowLeft'); await page.clock.runFor(200); await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(1300); await page.keyboard.up('ArrowUp');
  await page.keyboard.press('Space');
  let hit;
  for (let n = 0; n < 300; n++) {
    await page.clock.runFor(8);
    hit = (await snapshot(page)).obstacles.find(o => o.hp > 0 && o.hp < 5 && o.flash > .09 && o.y > 110);
    if (hit) break;
  }
  expect(hit, 'a public shockwave hits a living large obstacle inside the arena').toBeTruthy();
  expect(count(await image(page, info, 'hit-flash'), [255,245,215], center({ ...hit, y: hit.y + 10 }, 6))).toBeGreaterThan(100);
  await page.clock.runFor(128);
  const after = (await snapshot(page)).obstacles.find(o => o.radius === hit.radius && Math.hypot(o.x - hit.x, o.y - hit.y) < 10);
  expect(after?.hp).toBeGreaterThan(0);
  expect(after.flash).toBe(0);
  const faded = await image(page, info, 'flash-decayed'), area = center({ ...after, y: after.y + 10 }, 6);
  expect(count(faded, [255,245,215], area)).toBe(0);
  let brown = 0;
  // Nearby exposed background estimates the local backdrop; the brown fill
  // must actually remain, rather than merely stop displaying the flash color.
  for (let y = Math.ceil(area.y); y < area.y+area.height; y++) for (let x = Math.ceil(area.x); x < area.x+area.width; x++) {
    const at = (y*faded.width+x)*4, background = (y*faded.width+x+60)*4;
    if ([118,93,89].every((v,c) => Math.abs(faded.data[at+c] - (v*170/255 + faded.data[background+c]*85/255)) < 12)) brown++;
  }
  expect(brown, 'the surviving obstacle visibly returns to translucent brown').toBeGreaterThan(100);
  const newer = (await snapshot(page)).obstacles.find(o => o.flash > 0 && Math.hypot(o.x-after.x,o.y-after.y)<45);
  expect(newer, 'the later obstacle still flashes while overlapping the older faded one').toBeTruthy();
  const overlap = center({ x:(after.x+newer.x)/2, y:(after.y+newer.y)/2 }, 4);
  expect(count(faded, [255,245,215], overlap), 'later obstacle covers the older translucent fill in object order').toBeGreaterThan(50);
});

// Independent visual landmarks describe recognizable motifs, not vertices or
// renderer calls. Blank pockets distinguish each marker from a colored blob.
const motifs = {
  trajectory: { color: [120,244,196], ink: [[0,-10],[10,0],[0,10],[-10,0],[0,-3]], blank: [[8,8],[-8,-8]] },
  fireRate: { color: [111,207,255], ink: [[3,-10],[-3,10],[-7,1],[7,-1]], blank: [[4,-5],[-4,5]] },
  movement: { color: [255,225,120], ink: [[0,-8],[0,0],[-7,0],[7,8]], blank: [[0,-4],[0,5]] },
  piercing: { color: [210,167,255], ink: [[0,-10],[-6,-4],[6,-4],[0,8],[-10,3],[10,3]], blank: [[7,8],[-7,8]] },
  shockwave: { color: [255,187,102], ink: [[10,0],[-10,0],[0,10],[0,-10],[4.5,0],[-4.5,0]], blank: [[0,0],[7,0],[-7,0]] },
};
function hasMotif(image, resource) {
  const motif = motifs[resource.kind];
  return motif.ink.every(([x,y]) => count(image, motif.color, { x: resource.x+x-1.8, y: resource.y+y-1.8, width: 3.6, height: 3.6 }) > 0)
    && motif.blank.every(([x,y]) => count(image, motif.color, { x: resource.x+x-.6, y: resource.y+y-.6, width: 1.2, height: 1.2 }) === 0);
}

test('five released pickup markers preserve their distinct contour and internal motif', async ({ page }, info) => {
  await start(page, '() => .5');
  const seen = new Set();
  for (let step = 0; step < 450 && seen.size < 5; step++) {
    await page.clock.runFor(100);
    const state = await snapshot(page);
    for (const resource of [...state.resources].reverse()) {
      if (seen.has(resource.kind)) continue;
      const frame = await image(page, info, `drop-${resource.kind}`);
      if (!hasMotif(frame, resource)) continue;
      // The same color and outer extent alone cannot satisfy this shape oracle.
      const blob = { ...frame, data: Buffer.from(frame.data) }, color = motifs[resource.kind].color;
      for (let y = Math.floor(resource.y-12); y <= resource.y+12; y++) for (let x = Math.floor(resource.x-12); x <= resource.x+12; x++) {
        if (x >= 0 && x < blob.width && y >= 0 && y < blob.height) color.forEach((v,c) => { blob.data[(y*blob.width+x)*4+c] = v; });
      }
      expect(hasMotif(blob, resource), `${resource.kind} rejects a solid same-color square`).toBe(false);
      seen.add(resource.kind);
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(motifs).sort());
});

test('a released pickup remains correctly clipped when a paused resize intersects it', async ({ page }, info) => {
  await start(page, "purpose => purpose === 'side' ? .1 : .5");
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(800); await page.keyboard.up('ArrowUp');
  let drop;
  for (let step = 0; step < 100; step++) {
    await page.clock.runFor(100);
    drop = (await snapshot(page)).resources.find(r => r.kind === 'trajectory' && r.y > 300);
    if (drop) break;
  }
  expect(drop, 'a real destroyed carrier releases a pickup inside the arena').toBeTruthy();
  await page.keyboard.press('p');
  await page.addStyleTag({ content: '.game-modal { opacity:0 !important } .game-modal::backdrop { background:transparent !important } .game-hud { opacity:0 !important }' });
  const before = await image(page, info, 'released-before-resize');
  expect(hasMotif(before, drop)).toBe(true);
  const height = Math.floor(drop.y)+2;
  await page.setViewportSize({ width:1280, height });
  const frozen = (await snapshot(page)).resources.find(r => r.kind === 'trajectory');
  expect([frozen.x, frozen.y]).toEqual([drop.x, drop.y]);
  const clipped = await image(page, info, 'released-clipped-bottom');
  expect(count(clipped, motifs.trajectory.color, { x:drop.x-12, y:height-2, width:24, height:2 }), 'diamond contour reaches the new bottom edge').toBeGreaterThan(0);
  expect(count(clipped, motifs.trajectory.color, { x:drop.x-12, y:drop.y-12, width:24, height:12 }), 'upper half remains visible at its original scale').toBeGreaterThan(8);
  expect(count(clipped, motifs.trajectory.color, { x:drop.x-12, y:76, width:24, height:25 }), 'clipping never wraps the drop to the opposite edge').toBe(0);
});

test('overlapping translucent obstacles accumulate opacity in the shared image', async ({ page }, info) => {
  await start(page);
  await page.clock.runFor(3500);
  const obstacles = (await snapshot(page)).obstacles.filter(o => !o.warning && !o.flash);
  const [front, back] = obstacles;
  expect(Math.hypot(front.x-back.x, front.y-back.y)).toBeLessThan(45);
  const area = center({ x:(front.x+back.x)/2, y:(front.y+back.y)/2 }, 4);
  const frame = await image(page, info, 'transparent-obstacle-overlap');
  let doubled = 0;
  for (let y = Math.ceil(area.y); y < area.y+area.height; y++) for (let x = Math.ceil(area.x); x < area.x+area.width; x++) {
    const at = (y*frame.width+x)*4, backdrop = (y*frame.width+x+80)*4;
    // Two 2/3-opacity fills leave 1/9 of the background, not 1/3.
    const expected = [118,93,89].map((v,c) => v*8/9 + frame.data[backdrop+c]/9);
    const singleRed = 118*2/3 + frame.data[backdrop]/3;
    if (expected.every((v,c) => Math.abs(frame.data[at+c]-v)<7) && frame.data[at] > singleRed+10) doubled++;
  }
  expect(doubled, 'the overlap visibly contains both translucent objects').toBeGreaterThan(25);
});

for (const [width, height, density] of [[1280, 800, 2], [390, 844, 1], [390, 844, 3]]) test.describe(`directional detail ${width}x${height} DPR${density}`, () => {
  test.use({ viewport: { width, height }, deviceScaleFactor: density });
  test('piercing bolts retain their narrow elongated direction after actual pickup', async ({ page }, info) => {
    await start(page, '() => .5');
    let ready;
    for (let n = 0; n < 350; n++) {
      await page.clock.runFor(100);
      const drops = (await snapshot(page)).resources;
      ready = drops.some(r => r.kind === 'piercing') && drops.some(r => r.kind === 'trajectory');
      if (ready) break;
    }
    expect(ready).toBe(true);
    await page.keyboard.down('ArrowUp');
    for (let n = 0; n < 25 && !(await snapshot(page)).piercing; n++) await page.clock.runFor(100);
    await page.keyboard.up('ArrowUp');
    expect((await snapshot(page)).piercing).toBe(true);
    await page.keyboard.down('ArrowDown'); await page.clock.runFor(600); await page.keyboard.up('ArrowDown');
    await page.clock.runFor(80);
    const state = await snapshot(page), bullet = state.bullets.find(b => b.piercing && Math.abs(b.vx)>20 && b.y>150 && b.y<state.ship.y-45);
    expect(bullet, 'an oblique forward piercing ray is visibly inside the arena').toBeTruthy();
    const frame = PNG.sync.read(await page.screenshot({ path:info.outputPath('oblique-piercing.png') })), ratio=frame.width/width * (width < 800 ? .5 : 1);
    const speed=Math.hypot(bullet.vx,bullet.vy), dx=bullet.vx/speed, dy=bullet.vy/speed, points=[];
    for (let y=Math.floor((bullet.y-12)*ratio); y<(bullet.y+12)*ratio; y++) for (let x=Math.floor((bullet.x-8)*ratio); x<(bullet.x+8)*ratio; x++) {
      const px=(x+.5)/ratio-bullet.x, py=(y+.5)/ratio-bullet.y, along=px*dx+py*dy, across=px*-dy+py*dx;
      if (along < -8 || along > 4 || Math.abs(across)>2.5) continue;
      const at=(y*frame.width+x)*4;
      if ([210,167,255].every((v,c)=>Math.abs(frame.data[at+c]-v)<14)) points.push({x:px,y:py,along,across});
    }
    expect(points.length).toBeGreaterThan(Math.max(2, Math.floor(5 * ratio * ratio)));
    const extent=key=>Math.max(...points.map(p=>p[key]))-Math.min(...points.map(p=>p[key]));
    expect(extent('along')).toBeGreaterThan(10 - 4 / ratio); expect(extent('across')).toBeLessThan(3.5);
    expect(extent('along')).toBeGreaterThan(extent('across') * 2);
    const mean=key=>points.reduce((sum,p)=>sum+p[key],0)/points.length, mx=mean('x'),my=mean('y');
    const slope=points.reduce((sum,p)=>sum+(p.x-mx)*(p.y-my),0)/points.reduce((sum,p)=>sum+(p.y-my)**2,0);
    expect(Math.abs(slope-bullet.vx/bullet.vy), 'visible bolt axis follows its oblique flight, not a vertical icon').toBeLessThan(.1 / ratio);
  });
});

test.describe('released lightning at phone DPR1', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  test('fire-rate drop stays visible and native combat continues', async ({ page }, info) => {
    await start(page, '() => .5');
    let visible = false;
    for (let step = 0; step < 450 && !visible; step++) {
      await page.clock.runFor(100);
      await expect(page.locator('.space-game')).toBeVisible();
      const drop = (await snapshot(page)).resources.find(r => r.kind === 'fireRate');
      if (!drop) continue;
      const frame = await image(page, info, 'phone-released-lightning');
      const x = drop.x * .5, y = drop.y * .5;
      visible = count(frame, motifs.fireRate.color, { x:x-6, y:y-7, width:12, height:14 }) > 4;
    }
    expect(visible, 'real destroyed carrier releases visible blue lightning').toBe(true);
    const seconds = (await snapshot(page)).seconds;
    await page.clock.runFor(500);
    await expect(page.locator('.space-game')).toBeVisible();
    await expect(page.locator('#shader-canvas')).toBeVisible();
    expect((await snapshot(page)).seconds).toBeGreaterThan(seconds);
  });
});
