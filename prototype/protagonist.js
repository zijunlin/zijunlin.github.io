// THROWAWAY: three character candidates within the same C world; C selected; A/B retained for comparison.
import { regions, worldMarkup } from './protagonist-world.js';
const candidates = {
  A: {
    title:'A — 圆润讲解员', description:'像桌面上的小型雕塑，用轻轻点头建立亲和感。',
    appearance:'约 4 头身。圆头、宽肩短外套与圆角鞋；雾白哑光织物、石墨长裤、琥珀胸牌。',
    behavior:'固定站位；待机偶尔侧头，悬停轻倾回应，选中点头。打开面板不挪动，关闭后回到待机。',
    communication:'角色旁的短气泡；首次进入主动说一句“你好，可以从作品开始探索。”，6 秒后收起。交互提示不需要逐句点击。',
    cost:'低。一个简化人形，头部与躯干小幅动作；无需步行、路径或手臂指向系统。',
    question:'亲和的比例是否过于玩偶化？主动问候是否有必要？',
  },
  B: {
    title:'B — 精密工程师', description:'修长、克制的轮廓，用视线与指向建立内容联系。',
    appearance:'约 6 头身。窄肩立领外套、利落短发；石墨织物与雾白肩部，腕部一点琥珀色。',
    behavior:'脚下位置固定；悬停转向入口，选中抬手指向。面板展开时放下手臂并转回访客，关闭后恢复待机。',
    communication:'场景底部的一行字幕，只在交互后出现；首次进入保持安静。字幕不占用入口或目录位置。',
    cost:'中。躯干转向与单臂指向需要混合姿态；最终 3D 版本还需校准四区目标方向。',
    question:'更成人化的比例是否足够鲜明？字幕与角色的关联是否清楚？',
  },
  C: {
    title:'C — 随行创造者', description:'带着随身工具，在前景短距离靠近你正在看的内容。',
    appearance:'约 5 头身。蓬松短发、圆框眼镜与宽松工作夹克；雾白织物、石墨工具板、琥珀背带。',
    behavior:'待机低头看工具板；悬停抬头，选中后沿前景安全区换位最多 24 个场景单位。面板期间保持，关闭后归位；不走进入口之间。',
    communication:'场景底部的小型注释条，只在交互后出现；首次进入不主动说话，预览时收起。',
    cost:'中高。需短程移动、步态与停止衔接；本原型仅用位移示意，不代表已实现完整行走。',
    question:'移动带来的陪伴感是否值得增加动作成本？眼镜和工具是否在实际尺寸仍清楚？',
  },
};
const stateNames={idle:'默认待机',hover:'入口悬停',selected:'选中入口',panel:'面板展开',preview:'中央预览',closed:'关闭面板'};
const params=new URLSearchParams(location.search);
let variant=Object.hasOwn(candidates,params.get('variant'))?params.get('variant'):'C';
let world=params.get('world')==='system'?'system':'island';
let layout=params.get('layout')==='B'?'B':'A';
let state='idle', beforePreview='idle', selected='work', hovered=null, greeting=true, greetingTimer;
const $=selector=>document.querySelector(selector);
function character(key) {
  const headY={A:-56,B:-70,C:-63}[key];
  const headR={A:10,B:8,C:9}[key];
  const shoulders=key==='B'?10:15;
  return `<ellipse cy="3" rx="20" ry="6" fill="#071119" opacity=".7"/>
    <g class="character-pose"><path d="M-8,-23 L-9,-3 M7,-23 L9,-3" stroke="#35444b" stroke-width="9" stroke-linecap="round"/>
    <path d="M-15,-2 h10 M5,-2 h11" stroke="#a9b4b0" stroke-width="5" stroke-linecap="round"/>
    <path d="M-${shoulders},${headY+15} Q0,${headY+8} ${shoulders},${headY+15} L13,-20 Q0,-15 -13,-20 Z" fill="${key==='B'?'#566a71':'#c6cdc3'}" stroke="#879b9e" stroke-width="1"/>
    <path d="M-12,${headY+20} L-18,-29" stroke="#9caea9" stroke-width="8" stroke-linecap="round"/>
    <g class="arm"><path d="M12,${headY+20} L19,-30" stroke="${key==='B'?'#bec7bd':'#98a9a4'}" stroke-width="7" stroke-linecap="round"/><circle cx="19" cy="-28" r="3.5" fill="#c49e80"/></g>
    <path d="M-7,${headY+15} L-4,-24" stroke="#d1a567" stroke-width="${key==='C'?4:2}"/>
    <g class="head"><rect x="-3" y="${headY+6}" width="6" height="8" rx="2" fill="#b58f73"/><ellipse cy="${headY}" rx="${headR}" ry="${headR+2}" fill="#c8a58b"/>
    <path d="M-${headR},${headY+1} Q-${headR+5},${headY-16} 5,${headY-12} Q${headR+5},${headY-10} ${headR},${headY-1} L4,${headY-6} L-${headR-2},${headY-4} Z" fill="#25333b"/>
    <circle cx="-3" cy="${headY+1}" r="1" fill="#25333b"/><circle cx="5" cy="${headY+1}" r="1" fill="#25333b"/>
    ${key==='C'?`<g fill="none" stroke="#53616a" stroke-width="1.2"><circle cx="-3" cy="${headY+1}" r="3.5"/><circle cx="5" cy="${headY+1}" r="3.5"/><path d="M0,${headY+1} h2"/></g>`:''}</g>
    ${key==='C'?'<path d="M-17,-37 L3,-34 L1,-20 L-19,-23 Z" fill="#324952" stroke="#95a7a5"/><path d="M-14,-32 l11,2" stroke="#caab71"/>':''}</g>`;
}
function writeURL() {
  const url=new URL(location.href);
  for(const [key,value] of Object.entries({variant,world,layout})) url.searchParams.set(key,value);
  history.replaceState(null,'',url);
}
function buildScene() {
  $('#world-scene').innerHTML=`<svg viewBox="0 0 640 440" role="group" aria-label="${world==='island'?'建筑地形小岛':'抽象系统空间'}中的主角"><g>${worldMarkup(world,layout)}</g><g class="character-position" aria-label="主角精灵">${character(variant)}</g><g class="bubble" hidden><rect x="204" y="381" width="258" height="29" rx="8"/><text x="333" y="400" text-anchor="middle"></text></g></svg>`;
  document.querySelectorAll('[data-region]').forEach(el=>{
    const id=el.dataset.region;
    const enter=()=>{if(state==='preview')return;hovered=id;greeting=false;updateScene();};
    const leave=()=>{hovered=null;updateScene();};
    el.addEventListener('pointerenter',enter);el.addEventListener('pointerleave',leave);
    el.addEventListener('focus',enter);el.addEventListener('blur',leave);
    const activate=()=>{selected=id;setState('panel');};
    el.addEventListener('click',activate);
    el.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();activate();}});
  });
}
function updateScene() {
  const active=hovered || (['hover','selected','panel','preview'].includes(state)?selected:null);
  const region=regions.find(r=>r.id===(active||selected));
  const reacting=Boolean(active)&&state!=='preview';
  const baseX=layout==='A'?320:302;
  const direction=['about','career'].includes(active)?-1:1;
  const moveDirection=['about','career'].includes(selected)?-1:1;
  const moving=variant==='C'&&['selected','panel'].includes(state==='preview'?beforePreview:state);
  $('.character-position').style.transform=`translate(${baseX+(moving?moveDirection*24:0)}px, 369px)`;
  const pose=$('#world-scene .character-pose');
  pose.classList.toggle('responding',reacting&&state!=='panel');
  pose.classList.toggle('pointing',variant==='B'&&reacting&&state!=='panel');
  if(variant==='B') pose.style.transform=reacting&&state!=='panel'?`scaleX(${direction}) rotate(-4deg)`:'';
  $('.stage').classList.toggle('idle',!reacting);
  $('.stage').classList.toggle('previewing',state==='preview');
  document.querySelectorAll('[data-region]').forEach(el=>{el.classList.toggle('active',el.dataset.region===active);el.setAttribute('aria-pressed',String(el.dataset.region===selected&&['selected','panel'].includes(state)));});
  const message=reacting?region.copy:(variant==='A'&&greeting?'你好，可以从作品开始探索。':'');
  const bubble=$('.bubble');bubble.hidden=variant!=='A'||!message||state==='preview';
  // SVG hidden is set as an attribute as well for consistent browser rendering.
  bubble.toggleAttribute('hidden',bubble.hidden);bubble.querySelector('text').textContent=message;
  $('#guide').textContent=variant==='A'||state==='preview'?'':message;
  $('#guide').style.background=variant==='C'&&message?'#243640':'';
  $('#guide').style.padding=variant==='C'&&message?'10px 14px':'0';
  $('#panel').hidden=state!=='panel';$('#preview').hidden=state!=='preview';
  const panelRegion=regions.find(r=>r.id===selected);
  $('#panel-title').textContent=panelRegion.label;$('#panel-copy').textContent=panelRegion.copy;
  $('#open-preview').hidden=panelRegion.id!=='work';
  $('#scene-label').textContent=`${world==='island'?'建筑地形小岛':'抽象系统空间'} / ${layout==='A'?'环绕核心':'成长路径'}`;
  document.querySelectorAll('[data-state]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.state===state)));
  $('#status').textContent=`主角 ${variant} · 世界 ${world==='island'?'小岛':'系统空间'} · 布局 ${layout} · ${hovered?'悬停 '+region.label:stateNames[state]} · ${moving?'前景换位 24 单位':'默认站位'} · ${state==='preview'?'对话收起 / 动作暂停':'无强制对话流程'}`;
}
function setState(next) {
  if(next==='preview'&&state!=='preview') beforePreview=state;
  state=next;hovered=null;greeting=false;updateScene();
}
function closeOverlay() {setState(state==='preview'?beforePreview:'closed');}
function render() {
  clearTimeout(greetingTimer);
  const item=candidates[variant];
  for(const field of ['title','description','appearance','behavior','communication','cost','question']) $('#'+field).textContent=item[field];
  $('#placement').textContent=`${layout==='A'?'核心前景讲解位':'路径前景陪伴位'}；约占场景高度 ${variant==='B'?'19':variant==='A'?'16':'18'}%。主角与提示均在右侧安全带外，绘制于世界对象之上。`;
  $('#portrait').innerHTML=character(variant);
  $('#world').value=world;$('#layout').value=layout;
  document.querySelectorAll('[data-variant]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.variant===variant)));
  buildScene();updateScene();writeURL();
  if(greeting) greetingTimer=setTimeout(()=>{greeting=false;updateScene();},6000);
}
function changeVariant(key) {variant=key;greeting=state==='idle';hovered=null;render();}
function cycle(direction) {changeVariant(['A','B','C'][(['A','B','C'].indexOf(variant)+direction+3)%3]);}
$('#previous').onclick=()=>cycle(-1);$('#next').onclick=()=>cycle(1);
document.querySelectorAll('[data-variant]').forEach(el=>el.onclick=()=>changeVariant(el.dataset.variant));
for(const key of ['world','layout']) $('#'+key).onchange=event=>{if(key==='world')world=event.target.value;else layout=event.target.value;hovered=null;render();};
document.querySelectorAll('[data-state]').forEach(el=>el.onclick=()=>setState(el.dataset.state));
document.querySelectorAll('[data-close]').forEach(el=>el.onclick=closeOverlay);
$('#open-preview').onclick=()=>setState('preview');
document.addEventListener('keydown',event=>{
  if(event.target.closest('input,textarea,select,[contenteditable]'))return;
  if(event.key==='Escape')closeOverlay();
  if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();cycle(event.key==='ArrowLeft'?-1:1);}
});
document.addEventListener('visibilitychange',()=>$('.stage').classList.toggle('paused',document.hidden));
window.addEventListener('blur',()=>$('.stage').classList.add('paused'));
window.addEventListener('focus',()=>$('.stage').classList.remove('paused'));
if(import.meta.env.PROD) $('.switcher').hidden=true;
render();
