// THROWAWAY: three backgrounds on one comparison route, selected with ?variant=A|B|C.
import { worldMarkup } from './protagonist-world.js';
import { createBackground } from './backgrounds-renderer.js';
const candidates={
  A:{title:'A — 缓慢流体',description:'连续的低频流场，像水下缓慢交换的冷色层次；没有明确光源或中心图案。',motion:'四层低频噪声经过缓慢扭曲，形成连贯的明暗游移。速度默认 0.6×；观察 10–20 秒比较其流动感。',randomness:'种子改变噪声采样偏移、方向（±23°）与蓝灰到青灰的细微色偏。尺度只允许 0.7–1.3×，不生成细碎纹理。',cost:'相对较高：每像素三次四层噪声，共 12 次噪声采样；单次全屏绘制，无贴图。不是硬件性能实测。'},
  B:{title:'B — 斜向光雾',description:'宽而柔软的斜向光带缓慢漂移，让留白有方向，不形成聚光中心。',motion:'三条宽光雾带缓慢侧移，带边仅有一次低频弯曲。对比和速度沿用同一组控件，便于公平比较。',randomness:'种子改变光带相位、倾角（±23°）与有限青灰色偏；固定三条宽带，不生成细线或高亮扫光。',cost:'相对较低：三次宽带距离衰减与少量三角函数，无多层噪声、无贴图；实际耗时仍取决于设备。'},
  C:{title:'C — 层叠雾团',description:'几层大尺度雾团轻轻交错，强调空气纵深，轮廓比流体更稳定。',motion:'四个宽椭圆雾场以不同慢速漂移并叠加，边缘平滑消散。没有粒子、闪烁或快速涡旋。',randomness:'种子改变雾团初始位置、方向（±23°）与有限青灰色偏；固定四层，不随机增加密度、数量或亮度峰值。',cost:'相对中低：四次椭圆距离衰减与少量三角函数；没有体积步进、透明粒子或额外合成通道。'},
};
const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
const bounded=(key,fallback,min,max)=>{
  const value=Number(params.get(key));
  return params.has(key)&&params.get(key).trim()!==''&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
};
let variant=Object.hasOwn(candidates,params.get('variant'))?params.get('variant'):'A';
let seed=Math.floor(bounded('seed',Date.now()%1000000,0,999999));
const settings={speed:bounded('speed',.6,.3,1),contrast:bounded('contrast',.6,.3,1),scale:bounded('scale',1,.7,1.3),fallback:false};
let paused=false, frame=0, last=0;
const times=[0,0], statuses=['准备中','准备中'];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
// A simple hash breaks any readable relationship between local time and visual parameters.
function seedValue(value){let n=value|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
const silhouette=`<g aria-label="主角占位"><ellipse cx="320" cy="357" rx="15" ry="5" fill="#08131d"/><path d="M313,349 v-21 q7,-5 14,0 v21" fill="#9cafac"/><circle cx="320" cy="318" r="7" fill="#bbc6bc"/><text class="character-label" x="344" y="350">主角占位</text></g>`;
for(const element of document.querySelectorAll('.world')){
  element.innerHTML=`<svg viewBox="0 0 640 440" role="img" aria-label="固定层叠曲面小岛、四区标签与主角占位">${worldMarkup('island','A')}${silhouette}<text class="sub" x="320" y="410" text-anchor="middle">精选作品 · 智能语音平台</text></svg>`;
  element.querySelectorAll('[data-region]').forEach(el=>{el.removeAttribute('role');el.removeAttribute('tabindex');});
}
function status(){
  const mode=settings.fallback?'静态降级':document.hidden?'页面隐藏，动态暂停':paused?'手动暂停':reducedMotion.matches?'系统减少动态，保持静帧':'运行中（上限 30 fps）';
  $('#status').textContent=`背景 ${variant} · 种子 ${seed} · ${mode} · 左：${statuses[0]} / 右：${statuses[1]} · 预览速度 20%，背景不透明度 42%，世界不透明度 34%`;
}
const renderers=[...document.querySelectorAll('canvas')].map((canvas,i)=>createBackground(canvas,message=>{statuses[i]=message;status();}));
function draw(){
  const uniforms={...settings,seed:seedValue(seed),kind:['A','B','C'].indexOf(variant)};
  renderers.forEach((renderer,i)=>renderer.draw(uniforms,times[i]));
}
function running(){return !paused&&!settings.fallback&&!document.hidden&&!reducedMotion.matches&&renderers.some(renderer=>renderer.ready);}
function tick(now){
  frame=0;if(!running())return;
  if(!last)last=now;
  const elapsed=now-last;
  if(elapsed>=1000/30){
    const delta=Math.min(elapsed/1000,.1)*settings.speed;
    times[0]+=delta;times[1]+=delta*.2;last=now;draw();
  }
  frame=requestAnimationFrame(tick);
}
function resume(){cancelAnimationFrame(frame);frame=0;last=0;draw();status();if(running())frame=requestAnimationFrame(tick);}
function writeURL(){
  const url=new URL(location.href);
  for(const [key,value] of Object.entries({variant,seed,speed:settings.speed,contrast:settings.contrast,scale:settings.scale}))url.searchParams.set(key,value);
  history.replaceState(null,'',url);
}
function render(){
  const item=candidates[variant];
  for(const field of ['title','description','motion','randomness','cost'])$('#'+field).textContent=item[field];
  $('#seed').value=seed;
  for(const name of ['speed','contrast','scale']){$('#'+name).value=settings[name];$('#'+name+'-value').textContent=settings[name].toFixed(1)+'×';}
  document.querySelectorAll('[data-variant]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.variant===variant)));
  times.fill(0);writeURL();resume();
}
function cycle(direction){variant=['A','B','C'][(['A','B','C'].indexOf(variant)+direction+3)%3];render();}
$('#previous').onclick=()=>cycle(-1);$('#next').onclick=()=>cycle(1);
document.querySelectorAll('[data-variant]').forEach(el=>el.onclick=()=>{variant=el.dataset.variant;render();});
$('#seed').onchange=event=>{const n=event.target.valueAsNumber;if(Number.isFinite(n))seed=Math.floor(Math.max(0,Math.min(999999,n)));render();};
$('#new-seed').onclick=()=>{seed=crypto.getRandomValues(new Uint32Array(1))[0]%1000000;render();};
for(const name of ['speed','contrast','scale'])$('#'+name).oninput=event=>{settings[name]=Number(event.target.value);$('#'+name+'-value').textContent=settings[name].toFixed(1)+'×';writeURL();resume();};
$('#pause').onclick=()=>{paused=!paused;$('#pause').setAttribute('aria-pressed',String(paused));$('#pause').textContent=paused?'继续动态':'暂停动态';resume();};
$('#fallback').onchange=event=>{settings.fallback=event.target.checked;resume();};
document.addEventListener('visibilitychange',resume);
reducedMotion.addEventListener('change',resume);
window.addEventListener('resize',()=>draw());
// Renderer listeners initialize first; these resume the clock after context recovery.
document.querySelectorAll('canvas').forEach(canvas=>{canvas.addEventListener('webglcontextrestored',resume);canvas.addEventListener('webglcontextlost',resume);});
document.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,[contenteditable]'))return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();cycle(event.key==='ArrowLeft'?-1:1);}});
if(import.meta.env.PROD) $('.switcher').hidden=true;
render();
