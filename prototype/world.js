// THROWAWAY: selected C world + C character + A background. Review combinations via reload only.
import { createBackground } from './backgrounds-renderer.js';
const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
function hash(value){let n=value|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
const supplied=Number(params.get('seed'));
const seed=params.has('seed')&&params.get('seed').trim()!==''&&Number.isFinite(supplied)?Math.max(0,Math.min(999999,Math.floor(supplied))):Date.now()%1000000;
const world=['island','system'].includes(params.get('world'))?params.get('world'):(hash(seed+31)<.5?'island':'system');
const layout=['A','B'].includes(params.get('layout'))?params.get('layout'):(hash(seed+79)<.5?'A':'B');
const canonical=new URL(location.href);
for(const [key,value] of Object.entries({world,layout,seed}))canonical.searchParams.set(key,value);
history.replaceState(history.state,'',canonical);
const descriptions={about:'了解我的工程实践与关注方向。',career:'沿着项目经历，看看一路的选择。',work:'从智能语音平台，了解我的工程实践。',notes:'这里留给思考与记录，目前暂无正文。'};
const titles={about:'关于我',career:'职业历程',work:'作品集',notes:'随笔'};
const contents={
  about:`<p><strong>林子钧 · 曾任阿里巴巴 P7 技术专家</strong></p><p>拥有十余年阿里巴巴研发经验，长期扎根一线开发，持续从事核心系统研发与架构设计。</p><h3>让系统适应长期变化</h3><p>擅长从业务出发，将复杂问题抽象为职责清晰、边界明确的软件系统。关注核心业务与基础设施的分离，以及通用能力与差异化需求之间的平衡。</p><h3>亲手构建，专注创造</h3><p>重视清晰的命名、高质量的代码与有效的协作，坚持对系统从设计、实现到运行的结果负责。</p><h3>关注方向</h3><p>AI Native 应用、LLM 工程化、智能语音系统、分布式系统与平台架构设计。</p><p>欢迎围绕系统架构、AI 工程与产品合作交流。</p><div class="contact"><a href="mailto:linzijun.programmer@gmail.com">邮箱 ↗</a><a href="https://github.com/zijunlin" target="_blank" rel="noopener">GitHub ↗</a><a href="https://www.linkedin.com/in/子钧-林-441281a2" target="_blank" rel="noopener">LinkedIn ↗</a></div><button data-panel="career">查看职业历程</button>`,
  career:`<ol class="timeline"><li><time>2013</time><h3>来往</h3><p>负责 Android 客户端开发，投身移动互联网。</p></li><li><time>2016</time><h3>点点虫</h3><p>负责视频 App 开发，同时轮岗后端，拓展全栈实践。</p></li><li><time>2017</time><h3>菜鸟 · 裹裹</h3><p>负责裹裹 App 客户端开发。</p></li><li><time>2019</time><h3>智能语音平台</h3><p>负责平台建设、整体架构与核心系统研发。</p><button data-featured>预览关联作品</button></li><li><time>2026</time><h3>AI 探索</h3><p>关注大模型能力如何融入真实业务，持续探索 AI 工程与产品。</p></li></ol>`,
  work:`<p>从实际项目中，观察架构与工程决策。</p><button class="work-row" data-featured><span>智能语音平台</span><small>精选作品 · 架构设计 / 对话编排</small></button><p>将流转驱动与对话内容分离，通过可组合的 Action 支持业务扩展。</p>`,
  notes:`<div class="empty"><h3>还没有发布的随笔</h3><p>这里将记录技术思考、学习过程、创作体验与日常感悟。</p><p>先从作品中了解我的工程实践。</p><button data-panel="work">浏览作品</button></div>`,
};
let hovered=null,loaded=false,failed=false,paused=false,blurred=!document.hasFocus();
let backgroundStatus='准备中',frame=0,last=0,elapsed=0;
let fallback=params.get('fallback')==='1';
let currentRoute='';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const background=createBackground($('canvas'),message=>{backgroundStatus=message;$('#runtime').textContent=message;});
function previewOpen(){return currentRoute==='#work/platform';}
function currentPanel(){
  const source=history.state?.previewFrom?.slice(1);
  return previewOpen()?(Object.hasOwn(titles,source)?source:'work'):currentRoute.slice(1);
}
function drawBackground(){background.draw({seed:hash(seed),kind:0,contrast:1,scale:1.1,fallback},elapsed);}
function canAnimate(){return !document.hidden&&!paused&&!blurred&&!reducedMotion.matches&&!fallback&&background.ready;}
function animate(now){
  frame=0;if(!canAnimate())return;if(!last)last=now;
  if(now-last>=1000/30){elapsed+=Math.min((now-last)/1000,.1)*.8*(previewOpen()?.2:1);last=now;drawBackground();}
  frame=requestAnimationFrame(animate);
}
function resetParallax(){$('#world-motion').style.transform='';$('#background').style.transform='';}
function updateRuntime(){
  $('#review-status').textContent=`${world==='island'?'小岛':'系统'} / ${layout} · 种子 ${seed} · ${failed?'世界不可用':loaded?'已就绪':'加载中'} · ${previewOpen()?'预览':titles[currentPanel()]||'世界'}`;
  $('#runtime').textContent=fallback?'静态背景':backgroundStatus;
}
function syncAnimation(){
  cancelAnimationFrame(frame);last=0;
  document.body.classList.toggle('paused',paused||blurred||document.hidden||reducedMotion.matches);
  drawBackground();updateRuntime();if(canAnimate())frame=requestAnimationFrame(animate);
}
function updateCharacter(){
  if(!loaded)return;
  const selected=currentPanel(),active=hovered||selected;
  const direction=['about','career'].includes(selected)?-1:1;
  const x=(layout==='A'?320:302)+(selected?direction*24:0);
  $('.character-position').style.transform=`translate(${x}px,369px)`;
  $('.character-pose').classList.toggle('responding',Boolean(active));
  document.querySelectorAll('[data-region]').forEach(el=>{el.classList.toggle('active',el.dataset.region===active);el.setAttribute('aria-pressed',String(el.dataset.region===selected));});
  $('#annotation').textContent=descriptions[active]||'';
  $('#annotation').hidden=!active||previewOpen();
}
function route(){
  const hashValue=location.hash;
  const valid=['','#about','#career','#work','#notes','#work/platform'];
  currentRoute=valid.includes(hashValue)?hashValue:'';
  if(currentRoute!==hashValue)history.replaceState(null,'',location.pathname+location.search);
  const panel=currentPanel(),preview=previewOpen();hovered=null;
  document.body.classList.toggle('previewing',preview);
  $('#preview').hidden=!preview;$('#panel').hidden=!panel;
  $('header').inert=preview;$('#panel').inert=preview;$('.world-area').inert=preview;
  $('#return-directory').textContent='返回'+(titles[panel]||'作品目录');
  if(panel){$('#panel-title').textContent=titles[panel];$('#panel-kicker').textContent=panel==='work'?'精选 · 一个完整案例':'内容目录';$('#panel-content').innerHTML=contents[panel];}
  document.querySelectorAll('header [data-panel]').forEach(el=>{if(el.dataset.panel===panel)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  resetParallax();updateCharacter();syncAnimation();
}
function go(next){
  if(next===currentRoute)return;
  const isPreview=next==='#work/platform';
  const sameLevel=Boolean(currentRoute)&&!previewOpen()&&Boolean(next)&&!isPreview;
  const state=sameLevel
    ? {worldPrototype:history.state?.worldPrototype===true,from:history.state?.from??null}
    : {worldPrototype:Boolean(next),from:next?currentRoute:null};
  if(isPreview)state.previewFrom=currentRoute;
  const method=sameLevel||!next?'replaceState':'pushState';
  history[method](state,'',location.pathname+location.search+next);route();
}
function openPreview(){if(!currentRoute)go('#work');go('#work/platform');}
function closeLayer(){
  const target=previewOpen()?'#'+currentPanel():'';
  if(history.state?.worldPrototype&&history.state.from===target)history.back();
  else {history.replaceState(null,'',location.pathname+location.search+target);route();}
}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-home]')){event.preventDefault();go('');}
  const button=event.target.closest('[data-panel]');if(button)go('#'+button.dataset.panel);
  if(event.target.closest('[data-featured]'))openPreview();
});
$('#close-panel').onclick=closeLayer;$('#close-preview').onclick=closeLayer;$('#return-directory').onclick=closeLayer;
window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&currentRoute)closeLayer();});
$('#combination').textContent=`${world==='island'?'建筑地形小岛':'抽象系统空间'} · ${layout==='A'?'环绕核心':'成长路径'}`;
function reviewURL(changes){const url=new URL(location.href);url.hash='';for(const [key,value] of Object.entries(changes)){if(value===null)url.searchParams.delete(key);else url.searchParams.set(key,value);}return url.href;}
document.querySelectorAll('[data-combo]').forEach(el=>{const [w,l]=el.dataset.combo.split(',');el.href=reviewURL({world:w,layout:l});el.setAttribute('aria-current',String(w===world&&l===layout));});
$('#normal-load').href=reviewURL({load:null});$('#slow-load').href=reviewURL({load:'slow'});$('#failed-world').href=reviewURL({load:'fail'});
$('#fallback').checked=fallback;
$('#fallback').onchange=event=>{fallback=event.target.checked;syncAnimation();};
$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'继续动态':'暂停动态';$('#pause').setAttribute('aria-pressed',String(paused));syncAnimation();};
window.addEventListener('blur',()=>{blurred=true;resetParallax();syncAnimation();});
window.addEventListener('focus',()=>{blurred=false;syncAnimation();});
document.addEventListener('visibilitychange',()=>{resetParallax();syncAnimation();});
reducedMotion.addEventListener('change',syncAnimation);
window.addEventListener('resize',drawBackground);
$('canvas').addEventListener('webglcontextlost',syncAnimation);$('canvas').addEventListener('webglcontextrestored',syncAnimation);
$('.world-area').addEventListener('pointermove',event=>{
  if(!loaded||currentRoute||paused||blurred||reducedMotion.matches)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width-.5,y=(event.clientY-rect.top)/rect.height-.5;
  $('#world-motion').style.transform=`translate(${x*8}px,${y*8}px)`;
  $('#background').style.transform=`translate(${x*4}px,${y*4}px)`;
});
$('.world-area').addEventListener('pointerleave',resetParallax);
if(import.meta.env.PROD)$('#review-controls').hidden=true;
route();
const loadingTimer=setTimeout(()=>{$('#loading').hidden=false;},400);
try {
  const [{worldMarkup},{character}]=await Promise.all([import('./protagonist-world.js'),import('./character.js'),params.get('load')==='slow'?new Promise(resolve=>setTimeout(resolve,1400)):Promise.resolve()]);
  if(params.get('load')==='fail')throw new Error('Requested world failure demonstration');
  $('#scene').innerHTML=`<g class="world-objects">${worldMarkup(world,layout)}</g><g id="character-entry"><g class="character-position" aria-label="主角精灵：随行创造者">${character('C')}</g></g><g class="featured-hit" role="button" tabindex="0" aria-label="预览智能语音平台" data-featured><rect x="192" y="393" width="256" height="30" fill="transparent"/><text class="featured-title" x="320" y="414" text-anchor="middle">精选作品 · 智能语音平台 ↗</text></g>`;
  document.querySelectorAll('[data-region]').forEach(el=>{
    el.addEventListener('pointerenter',()=>{if(previewOpen())return;hovered=el.dataset.region;updateCharacter();});
    el.addEventListener('pointerleave',()=>{hovered=null;updateCharacter();});
    el.addEventListener('click',()=>go('#'+el.dataset.region));
    el.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();go('#'+el.dataset.region);}});
  });
  $('.featured-hit').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();openPreview();}});
  loaded=true;updateCharacter();document.body.classList.add('entering');setTimeout(()=>document.body.classList.remove('entering'),900);
}catch{
  failed=true;$('#world-error').hidden=false;$('#review-status').textContent='世界显示失败；内容导航仍可用';
}finally{
  clearTimeout(loadingTimer);$('#loading').hidden=true;document.body.classList.remove('loading');updateRuntime();
}
