import { colorPoints as colored } from '../helpers/game-canvas.js';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { startCombat } from '../helpers/combat-scenario.js';
import { observeGameDrawing, drawnShipBox } from '../helpers/game-drawing.js';

async function start(page) {
  await page.addInitScript(observeGameDrawing);
  await page.addInitScript(()=>{Math.random=purpose=>purpose==='position'?(window.edgeSpawnPosition??.1):.1;});
  await startCombat(page, { random: 'Math.random' });
}
for(const phone of [false,true])test.describe(phone?'phone DPR3':'desktop DPR1',()=>{
  const width=phone?390:1280,height=phone?844:800,scale=phone?.5:1;
  test.use({viewport:{width,height},deviceScaleFactor:phone?3:1,hasTouch:phone,isMobile:phone,reducedMotion:'reduce'});
  for(const [edge,key] of [['left','ArrowLeft'],['right','ArrowRight'],['top','ArrowUp'],['bottom','ArrowDown']]){
    test(`wave clips at ${edge} without clipping later formation artwork`,async({page,browserName},info)=>{
      test.skip(browserName==='webkit'&&(phone||edge!=='top'),'One WebKit edge complements the Chrome four-edge matrix');
      test.setTimeout(90000);await start(page);
      await page.keyboard.down(key);await page.clock.runFor(edge==='top'&&phone?4300:2200);await page.keyboard.up(key);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const header=await page.locator('.site-header').boundingBox(),top=header.y+header.height;
      // Reveal the unchanged shared output behind DOM overlays without changing
      // header geometry or the arena. No graphics replacement is introduced.
      const overlay=await page.addStyleTag({content:'.site-header,.game-hud,.game-controls { opacity:0 !important }'});
      await page.keyboard.press('Space');await page.clock.runFor(120);
      const snapshot=await page.evaluate(()=>window.battleSnapshot),wave=snapshot.shockwaves[0];expect(wave).toBeTruthy();
      const image=PNG.sync.read(await page.screenshot({path:info.outputPath(`${edge}-clipped-wave.png`)}));
      const x=wave.x*scale,y=wave.y*scale,r=wave.radius*scale;
      const pixels=colored(image,{width,height},[155,232,255],{x:x-r-3,y:y-r-3,width:2*r+6,height:2*r+6},20);
      expect(pixels.length).toBeGreaterThan(10);
      expect(pixels.every(p=>p.y>=top),'nothing from the wave paints above the arena').toBe(true);
      const distances=pixels.map(p=>Math.hypot(p.x-x,p.y-y)).sort((a,b)=>a-b);
      expect(Math.abs(distances[Math.floor(distances.length/2)]-r)).toBeLessThan(1.5);
      const axis=edge==='left'||edge==='right'?'x':'y',boundary=edge==='left'?0:edge==='right'?width:edge==='top'?top:height;
      expect(Math.min(...pixels.map(p=>Math.abs(p[axis]-boundary))),'partial arc reaches the clipping edge').toBeLessThan(2);
      const opposite=edge==='left'?{x:width-10,y:top,width:10,height:height-top}:edge==='right'?{x:0,y:top,width:10,height:height-top}:edge==='top'?{x:0,y:height-10,width,height:10}:{x:0,y:top,width,height:10};
      expect(colored(image,{width,height},[155,232,255],opposite,20).length,'clipping never wraps to the opposite edge').toBe(0);
      const box=await drawnShipBox(page);
      const cockpit=colored(image,{width,height},[237,253,255],{x:box.x+11*scale,y:box.y+12*scale,width:5*scale,height:8*scale},30);
      expect(cockpit.length,'ship drawn after combat remains visible even at the arena edge').toBeGreaterThan(0);
      if(edge==='top'){
        const ratio=image.width/width;let above=0;
        // The model keeps the full hull inside the arena, but its upper
        // satellite deliberately extends above it. That is the cleanup probe.
        for(let py=Math.floor((y-36*scale)*ratio);py<Math.min(top,y-24*scale)*ratio;py++)for(let px=Math.floor((x-6*scale)*ratio);px<(x+6*scale)*ratio;px++){
          const i=(py*image.width+px)*4;if(image.data[i]>50&&image.data[i+1]>80&&image.data[i+2]>90)above++;
        }
        expect(above,'combat scissor must not cut the satellite above arena').toBeGreaterThan(3);
      }
      await page.clock.runFor(16);
      await page.screenshot({path:info.outputPath(`${edge}-next-frame.png`)});
      await overlay.evaluate(node=>node.remove());
    });
  }
});

test.describe('phone DPR3 fast edge',()=>{
  test.use({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  test('warning and fast wake retain their clipped edge geometry',async({page,browserName},info)=>{
    test.skip(browserName==='webkit','Chrome-specific supplementary fast edge scenario');test.setTimeout(90000);
    await page.addInitScript(()=>{window.edgeSpawnPosition=.6;});await start(page);
    await page.clock.runFor(6500);await page.keyboard.down('ArrowUp');await page.clock.runFor(1500);await page.keyboard.up('ArrowUp');
    let fast;
    for(let n=0;n<30;n++){fast=await page.evaluate(()=>window.battleSnapshot.obstacles.find(o=>o.fast&&o.warning>0));if(fast)break;await page.clock.runFor(100);}
    expect(fast).toBeTruthy();
    const warning=PNG.sync.read(await page.screenshot({path:info.outputPath('fast-edge-warning.png')}));
    expect(colored(warning,{width:390,height:844},[255,240,122],{x:0,y:fast.y*.5-15,width:20,height:30},20).length).toBeGreaterThan(8);
    await page.clock.runFor(Math.ceil(fast.warning*1000)+180);
    fast=await page.evaluate(()=>window.battleSnapshot.obstacles.find(o=>o.fast&&o.warning===0));expect(fast).toBeTruthy();
    const image=PNG.sync.read(await page.screenshot({path:info.outputPath('fast-clipped-wake.png')}));
    const speed=Math.hypot(fast.vx,fast.vy),dx=fast.vx/speed,dy=fast.vy/speed;
    expect((fast.x-dx*(fast.radius*.6+18))*.5,'wake endpoint lies beyond left edge').toBeLessThan(0);
    const yellow=colored(image,{width:390,height:844},[255,240,122],{x:0,y:fast.y*.5-15,width:30,height:30},20);
    const tail=yellow.filter(p=>-((p.x-fast.x*.5)*dx+(p.y-fast.y*.5)*dy)>fast.radius*.5+.5);
    expect(tail.length,'exposed wake pixels remain on the visible side of clipping').toBeGreaterThan(2);
    expect(Math.min(...tail.map(p=>p.x)),'wake reaches the left clip boundary').toBeLessThan(1);
    expect(colored(image,{width:390,height:844},[255,240,122],{x:380,y:0,width:10,height:844},20).length).toBe(0);
  });
});
