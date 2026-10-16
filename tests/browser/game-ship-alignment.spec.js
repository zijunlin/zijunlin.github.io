import { test, expect } from '@playwright/test';
import { observeGameDrawing } from '../helpers/game-drawing.js';
import { startCombat } from '../helpers/combat-scenario.js';

test.use({viewport:{width:1729,height:1201},deviceScaleFactor:3});
test('paused resize and context restoration align the retained ship to the actual framebuffer',async({page})=>{
  await page.addInitScript(observeGameDrawing);
  await startCombat(page,{random:'() => .5'});
  await page.keyboard.down('ArrowLeft');await page.clock.runFor(112);await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('p');
  const seconds=await page.evaluate(()=>window.battleSnapshot.seconds);
  async function aligned(){
    await expect.poll(()=>page.evaluate(()=>{
      const canvas=document.querySelector('#shader-canvas'),ship=window.gameDrawing.ship,state=window.battleSnapshot;
      if (!ship) return Infinity;
      const rx=canvas.width/innerWidth,ry=canvas.height/innerHeight;
      return Math.max(Math.abs(ship.x-Math.round((state.ship.x-13.2)*rx)/rx),Math.abs(ship.y-Math.round((state.ship.y-16.5)*ry)/ry));
    })).toBeLessThan(1e-7);
    expect(await page.evaluate(()=>window.battleSnapshot.seconds)).toBe(seconds);
  }
  await aligned();
  for(const viewport of [{width:1801,height:1199},{width:1280,height:800}]){
    await page.setViewportSize(viewport);await page.clock.runFor(32);await aligned();
  }
  await page.evaluate(()=>{
    const ext=document.querySelector('#shader-canvas').getContext('webgl').getExtension('WEBGL_lose_context');
    if(!ext)throw new Error('Context loss extension unavailable');window.restoreShipContext=()=>ext.restoreContext();ext.loseContext();
  });
  await page.waitForFunction(()=>document.querySelector('#shader-canvas').getContext('webgl').isContextLost());
  await page.evaluate(()=>{ delete window.gameDrawing.ship; window.restoreShipContext(); });
  await page.waitForFunction(()=>!document.querySelector('#shader-canvas').getContext('webgl').isContextLost());
  await page.clock.runFor(32);await aligned();
  await expect(page.getByRole('button',{name:'继续游戏',exact:true})).toBeVisible();
});
