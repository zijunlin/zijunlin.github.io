import { colorPoints as points } from '../helpers/game-canvas.js';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { startCombat } from '../helpers/combat-scenario.js';
import { observeGameDrawing, drawnShipBox, expectSatellites } from '../helpers/game-drawing.js';

const cases = [
  { width:1280, height:800, dpr:1, motion:'reduce', webkit:true },
  { width:1280, height:800, dpr:2, motion:'no-preference' },
  { width:1280, height:800, dpr:3, motion:'reduce' },
  { width:390, height:844, dpr:1, motion:'reduce' },
  { width:390, height:844, dpr:2, motion:'no-preference', webkit:true },
  { width:390, height:844, dpr:3, motion:'reduce' },
];
async function frame(page, info, name) {
  return PNG.sync.read(await page.screenshot({ path: info.outputPath(`${name}.png`) }));
}
// Recover coverage against the same displayed background. Thin one-CSS-pixel
// rings may have no fully opaque pixel at DPR1, but their total visible area
// must remain. Residual rejects unrelated background motion/colors.
function coveredArea(image, before, viewport, color, box) {
  const ratio=image.width/viewport.width;let area=0;
  for(let y=Math.max(0,Math.floor(box.y*ratio));y<Math.min(image.height,(box.y+box.height)*ratio);y++)for(let x=Math.max(0,Math.floor(box.x*ratio));x<Math.min(image.width,(box.x+box.width)*ratio);x++){
    const i=(y*image.width+x)*4, direction=color.map((v,c)=>v-before.data[i+c]);
    const norm=direction.reduce((sum,v)=>sum+v*v,0);
    const alpha=direction.reduce((sum,v,c)=>sum+v*(image.data[i+c]-before.data[i+c]),0)/norm;
    if(alpha<.15||alpha>1.1)continue;
    if(color.every((_,c)=>Math.abs(image.data[i+c]-before.data[i+c]-alpha*direction[c])<12))area+=Math.min(1,alpha);
  }
  return area/(ratio*ratio);
}
async function state(page) { return page.evaluate(()=>window.battleSnapshot); }
async function surface(page) {
  const size=await page.locator('#shader-canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height,cssWidth:innerWidth,cssHeight:innerHeight}));
  expect(size.width*size.height).toBeLessThanOrEqual(3840*2160);
  expect(size.width/size.height).toBeCloseTo(size.cssWidth/size.cssHeight,2);
  await expect(page.locator('canvas')).toHaveCount(1);
  return size;
}
async function shots(page, info, scale, name) {
  const snapshot=await state(page), viewport=page.viewportSize(), image=await frame(page,info,name);
  const header=await page.locator('.site-header').boundingBox();
  const bullets=snapshot.bullets.filter(b=>!b.piercing && b.y*scale>header.y+header.height+35 && b.y*scale<snapshot.ship.y*scale-40 && Math.abs(b.x-snapshot.ship.x)<50);
  expect(bullets.length,'public scenario contains visible forward shots').toBeGreaterThan(0);
  let visible=0;
  for (const bullet of bullets.slice(0,6)) {
    const x=bullet.x*scale,y=bullet.y*scale, extent=bullet.radius*scale+.5;
    const pixels=points(image,viewport,[201,245,250],{x:x-extent,y:y-extent,width:extent*2,height:extent*2},30);
    if (pixels.length) {
      const cx=pixels.reduce((sum,p)=>sum+p.x,0)/pixels.length,cy=pixels.reduce((sum,p)=>sum+p.y,0)/pixels.length;
      expect(Math.abs(cx-x)).toBeLessThan(1.2); expect(Math.abs(cy-y)).toBeLessThan(1.2); visible++;
    }
  }
  expect(visible,'actual composed circular shots align with fractional simulation').toBeGreaterThan(0);
}
async function wave(page,info,scale,name) {
  const snapshot=await state(page), w=snapshot.shockwaves[0];expect(w).toBeTruthy();
  const x=w.x*scale,y=w.y*scale,r=w.radius*scale;
  const image=await frame(page,info,name),pixels=points(image,page.viewportSize(),[155,232,255],{x:x-r-3,y:y-r-3,width:r*2+6,height:r*2+6},25);
  expect(pixels.length).toBeGreaterThan(8);
  const distances=pixels.map(p=>Math.hypot(p.x-x,p.y-y)).sort((a,b)=>a-b);
  expect(Math.abs(distances[Math.floor(distances.length/2)]-r),'ring has correct CSS radius at actual density').toBeLessThan(1.5);
  expect(pixels.some(p=>p.x<x-r*.7)).toBe(true);expect(pixels.some(p=>p.x>x+r*.7)).toBe(true);
  return r;
}
async function start(page) {
  await page.addInitScript(observeGameDrawing);
  await startCombat(page, { random: "purpose => purpose === 'position' ? .75 : .5", advance: 3500 });
}
for (const c of cases) test.describe(`${c.width}x${c.height} DPR${c.dpr} ${c.motion}`,()=>{
  const phone=c.width<800,scale=phone?.5:1;
  test.use({viewport:{width:c.width,height:c.height},deviceScaleFactor:c.dpr,reducedMotion:c.motion,hasTouch:phone,isMobile:phone});
  test.skip(({browserName})=>browserName==='webkit'&&!c.webkit,'Representative WebKit rows complement the Chrome density matrix');
  test('combat retains coordinates and details through density, height, rotation and frozen reflow',async({page},info)=>{
    test.setTimeout(120000);await start(page);
    const dimensions=await surface(page);
    writeFileSync(info.outputPath('environment.json'),JSON.stringify({project:info.project.name,browser:page.context().browser().version(),scenario:c,surface:dimensions,physicalDevice:false},null,2));
    await shots(page,info,scale,'initial-shots');
    const header=await page.locator('.site-header').boundingBox(),top=header.y+header.height;
    const beforeWarning=await frame(page,info,'before-warning');
    await page.clock.runFor(900);
    const warning=await frame(page,info,'edge-warning');
    expect(coveredArea(warning,beforeWarning,page.viewportSize(),[244,200,128],{x:c.width*.75-18*scale,y:top,width:36*scale,height:28*scale}),'thin warning preserves visible coverage').toBeGreaterThan(12*scale*scale);
    let carrier;
    for(let attempt=0;attempt<45;attempt++){
      carrier=(await state(page)).obstacles.find(o=>o.resource==='trajectory'&&o.warning>0);
      if(carrier)break;await page.clock.runFor(100);
    }
    expect(carrier).toBeTruthy();
    const marker=await frame(page,info,'carried-diamond');
    const green=points(marker,page.viewportSize(),[120,244,196],{x:carrier.x*scale-9*scale,y:top,width:18*scale,height:20*scale},25);
    expect(green.length,'small carried diamond remains identifiable at actual density').toBeGreaterThan(2);
    expect(Math.max(...green.map(p=>p.x))-Math.min(...green.map(p=>p.x))+1/c.dpr).toBeGreaterThan(4*scale);

    await page.keyboard.down('ArrowUp');await page.clock.runFor(250);await page.keyboard.up('ArrowUp');
    await page.keyboard.down('ArrowRight');await page.clock.runFor(17);await page.keyboard.up('ArrowRight');
    const moving=await state(page);expect(Number.isInteger(moving.ship.x)).toBe(false);
    await shots(page,info,scale,'fractional-shots');
    await page.keyboard.press('Space');await page.clock.runFor(80);
    const first=await wave(page,info,scale,'wave-small');await page.clock.runFor(80);
    expect(await wave(page,info,scale,'wave-large')).toBeGreaterThan(first+10*scale);
    await expectSatellites(page);
    if(phone){
      await page.clock.runFor(1200);
      await page.setViewportSize({width:390,height:760});await expect(page.getByRole('dialog')).toHaveCount(0);
      const before=(await state(page)).seconds;await page.clock.runFor(100);expect((await state(page)).seconds).toBeGreaterThan(before);
      await page.setViewportSize({width:844,height:390});
    }else await page.setViewportSize({width:1000,height:700});
    await expect(page.getByRole('dialog',{name:'游戏已暂停'})).toBeVisible();await surface(page);
    const frozen=(await state(page)).seconds;await page.clock.runFor(300);expect((await state(page)).seconds).toBe(frozen);
    // Hide only the DOM modal/backdrop to inspect the unchanged paused output.
    const overlay=await page.addStyleTag({content:'.game-modal { opacity:0 !important } .game-modal::backdrop { background:transparent !important; backdrop-filter:none !important }'});
    await shots(page,info,scale,'paused-resize-shots');await overlay.evaluate(node=>node.remove());
    await page.getByRole('button',{name:'继续游戏',exact:true}).click();await page.clock.runFor(200);
    await shots(page,info,scale,'resumed-shots');
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'本局结束'})).toBeVisible();
    const result=(await state(page)).seconds;
    await page.setViewportSize(phone?{width:390,height:844}:{width:1100,height:750});await page.clock.runFor(200);
    expect((await state(page)).seconds).toBe(result);await surface(page);
    const resultOverlay=await page.addStyleTag({content:'.game-modal { opacity:0 !important } .game-modal::backdrop { background:transparent !important; backdrop-filter:none !important }'});
    await shots(page,info,scale,'results-resize-shots');await resultOverlay.evaluate(node=>node.remove());
    await page.getByRole('button',{name:'返回首页',exact:true}).click();await page.clock.runFor(1800);
    await expect(page.locator('.space-game')).toHaveCount(0);await expect(page.locator('.celestial-gate').first()).toBeVisible();
    await frame(page,info,'returned-home');
  });
});
