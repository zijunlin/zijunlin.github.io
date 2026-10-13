// Real headed hardware workload; no state injection. Run with other tests idle:
// npm run build
// npm run preview -- --host 127.0.0.1 --port 4184
// node tests/manual/game-growth-runtime.mjs
// Route wrapper observes createBattle's public state and supplies a deterministic random source.
// Setup accelerates RAF timestamps 6x and drives actual keyboard events to collect real drops.
// Measurement restores native RAF, runs foreground for 180 seconds, and retains background/trails.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = process.env.GAME_EVIDENCE_DIR || '/tmp/sprite-04-hardware';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:false,args:['--window-position=50,50']});
const context=await browser.newContext({viewport:{width:1280,height:720},locale:'zh-CN',reducedMotion:'no-preference'});
const page=await context.newPage();
let report={};
try {
 const system=await(await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
 report={browser:browser.version(),viewport:'1280x720',gpu:system.gpu,method:'Actual page; read-only public battle observer; deterministic valid spawn random source; DOM keyboard event real pickup setup; accelerated RAF setup only; native RAF measurement.'};
 await page.route(/\/assets\/space-game-[^/]+\.js(?:\?.*)?$/,async route=>{
  report.productionBundle=route.request().url();
  const response=await route.fetch(); let body=await response.text();
  const signature=body.match(/function ([A-Za-z_$][\w$]*)\(\{bounds:[\w$]+,random:[\w$]+=Math\.random,reducedMotion:[\w$]+=!1\}\)/);
  if(!signature)throw Error('Built battle constructor signature changed: update read-only observer');
  body=body.replace(signature[0],signature[0].replace('function '+signature[1]+'(', 'function observedCreateBattle('));
  body+='\nfunction '+signature[1]+'(options) { let draw=0, spawn=0, measuring=false; const battle=observedCreateBattle({...options,random:()=>{ if(window.measureMode&&!measuring){draw=0;measuring=true;} if(battle.state.seconds<9) return .5; const slot=draw++%6; if(slot===5) return window.measureMode && (++spawn%7===0) ? .1 : .5; return .5; }}); Object.defineProperty(window,"battleSnapshot",{configurable:true,get:()=>JSON.parse(JSON.stringify(battle.state))}); return battle; }';
  await route.fulfill({response,body});
 });
 await page.addInitScript(()=>{
  window.nativeRAF=requestAnimationFrame.bind(window); window.setup=true;window.measureMode=false;window.backgroundDraws=0;
  const draw=WebGLRenderingContext.prototype.drawArrays;
  WebGLRenderingContext.prototype.drawArrays=function(...args){if(this.canvas.id==='shader-canvas')window.backgroundDraws++;return draw.apply(this,args);};
  let origin;
  window.requestAnimationFrame=callback=>window.nativeRAF(now=>{origin??=now;callback(window.setup?origin+(now-origin)*6:now);});
  window.pickupHistory=[];let lastCount=2, held=new Set();
  window.driveKeys=(x,y)=>{const desired=new Set();if(x<0)desired.add('ArrowLeft');if(x>0)desired.add('ArrowRight');if(y<0)desired.add('ArrowUp');if(y>0)desired.add('ArrowDown');for(const key of held)if(!desired.has(key))window.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));for(const key of desired)if(!held.has(key))window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));held=desired;};
  const control=()=>{const s=window.measureMode?null:window.battleSnapshot;if(s){if(s.trajectoryCount!==lastCount){window.pickupHistory.push({seconds:s.seconds,count:s.trajectoryCount});lastCount=s.trajectoryCount;}const drop=window.settle?null:s.resources[0];const target=drop?{x:drop.x,y:drop.y+65}:{x:640,y:innerHeight-85};const sign=n=>Math.abs(n)<15?0:Math.sign(n);window.driveKeys(sign(target.x-s.ship.x),sign(target.y-s.ship.y));}window.nativeRAF(control);};window.nativeRAF(control);
 });
 await page.goto('http://127.0.0.1:4184/?seed=0'); await page.bringToFront();
 await page.waitForFunction(()=>window.battleSnapshot,{timeout:45000});
 for(let part=0;part<60;part++){
  await page.waitForTimeout(3000);const s=await page.evaluate(()=>window.battleSnapshot);console.log(JSON.stringify({phase:'setup',seconds:s.seconds,count:s.trajectoryCount,ship:s.ship,ended:s.ended}));
  if(s.ended)throw Error('Legitimate pickup setup ended before target workload');
  if(s.trajectoryCount===24)break;
 }
 report.setup=await page.evaluate(()=>({state:window.battleSnapshot,pickups:window.pickupHistory}));
 if(report.setup.state.trajectoryCount!==24)throw Error('Setup did not attain 24 trajectories');
 await page.evaluate(()=>window.settle=true);await page.waitForTimeout(700);await page.keyboard.press('p');
 await page.evaluate(()=>{window.driveKeys(0,0);window.setup=false;window.measureMode=true;window.requestAnimationFrame=window.nativeRAF;});
 // Reset accelerated frame clocks through the existing public visibility lifecycle before measurement.
 // Explicit visibilitychange is needed because headed Chrome can retain visibility while switching tabs.
 const resetTab=await context.newPage();await resetTab.bringToFront();await resetTab.waitForTimeout(100);await page.bringToFront();await resetTab.close();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.getByRole('button',{name:'继续游戏',exact:true}).click();
 await page.bringToFront();await page.waitForTimeout(1000);
 await page.evaluate(()=>{
  window.measurement={start:performance.now(),intervals:[],interrupted:false,backgroundStart:window.backgroundDraws,fast:0,ordinary:0,maxBullets:0,shipDistance:0};let previous,previousShip;
  function measure(now){const m=window.measurement,s=window.battleSnapshot;if(previous)m.intervals.push(now-previous);previous=now;if(s){m.fast+=s.obstacles.filter(o=>o.fast).length;m.coexisting||=s.obstacles.some(o=>o.fast)&&s.obstacles.some(o=>!o.fast);m.ordinary+=s.obstacles.filter(o=>!o.fast).length;m.maxBullets=Math.max(m.maxBullets,s.bullets.length);m.ended||=s.ended;if(previousShip)m.shipDistance+=Math.hypot(s.ship.x-previousShip.x,s.ship.y-previousShip.y);previousShip=s.ship;m.attributesValid=(m.attributesValid??true)&&s.trajectoryCount===24&&s.fireInterval===.11&&s.piercing&&s.ship.movementSpeed===570;}
   if(document.hidden||!document.hasFocus()||document.querySelector('.game-modal[open]')){m.interrupted=true;m.reason={hidden:document.hidden,focus:document.hasFocus(),modal:document.querySelector('.game-modal[open]')?.textContent,ended:s?.ended};}
   if(now-m.start<180000)requestAnimationFrame(measure);else m.done=true;
  }requestAnimationFrame(measure);
 });
 // Demonstrate highest movement speed while keeping the full fan pointed at spawning targets.
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(200);await page.keyboard.up('ArrowLeft');
 for(let part=0;part<6;part++){await page.waitForTimeout(30000);console.log(JSON.stringify(await page.evaluate(()=>({phase:'measurement',seconds:(performance.now()-measurement.start)/1000,frames:measurement.intervals.length,interrupted:measurement.interrupted,reason:measurement.reason,backgroundDraws:window.backgroundDraws-measurement.backgroundStart,fast:measurement.fast,ordinary:measurement.ordinary,coexisting:measurement.coexisting,attributesValid:measurement.attributesValid,shipDistance:measurement.shipDistance,ended:measurement.ended}))));if(await page.evaluate(()=>measurement.interrupted||window.backgroundDraws===measurement.backgroundStart||!measurement.fast||!measurement.ordinary||!measurement.coexisting||!measurement.attributesValid||measurement.shipDistance<=100||measurement.ended))break;}
 report.measurement=await page.evaluate(()=>{const m=window.measurement,sorted=[...m.intervals].sort((a,b)=>a-b),seconds=m.intervals.reduce((a,b)=>a+b,0)/1000;const gl=document.querySelector('#shader-canvas').getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{...m,intervals:undefined,seconds,fps:m.intervals.length/seconds,within25ms:m.intervals.filter(n=>n<=25).length/m.intervals.length,p95ms:sorted[Math.floor(sorted.length*.95)],p99ms:sorted[Math.floor(sorted.length*.99)],backgroundDraws:window.backgroundDraws-m.backgroundStart,webglRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,screen:{width:screen.width,height:screen.height,devicePixelRatio},state:window.battleSnapshot};});
 const m=report.measurement;
 const groups=new Map();for(const b of m.state.bullets.filter(b=>b.piercing)){const life=Number(b.life.toFixed(6));groups.set(life,(groups.get(life)||0)+1);}
 m.forwardCohorts=[...groups].sort((a,b)=>b[0]-a[0]).map(([life,count],index,array)=>({life,count,interval:index?Number((array[index-1][0]-life).toFixed(6)):null}));
 m.fullForwardCohort=m.forwardCohorts.some(group=>group.count===24);
 report.valid=!!(m.done&&!m.interrupted&&!m.ended&&m.seconds>=179.5&&m.attributesValid&&m.fullForwardCohort&&m.fast&&m.ordinary&&m.coexisting&&m.shipDistance>100&&m.backgroundDraws>=1000&&m.webglRenderer&&!/swiftshader|llvmpipe|software/i.test(m.webglRenderer)&&system.gpu.featureStatus.gpu_compositing==='enabled');
 report.passed=report.valid&&m.within25ms>=.95;
 await page.screenshot({path:`${output}/max-growth.png`});
 if(!report.passed)throw Error('Workload validity or frame target not met');
}catch(error){report.error=String(error);report.valid??=false;report.passed=false;await page.screenshot({path:`${output}/diagnostic.png`}).catch(()=>{});process.exitCode=1;}
finally{await writeFile(`${output}/hardware-performance.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({valid:report.valid,passed:report.passed,error:report.error}));await browser.close();}
