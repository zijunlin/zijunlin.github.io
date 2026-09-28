// THROWAWAY: object styles only. All three candidates share projection and layout.
const candidates = {
  A: {
    title: 'A — 实体台地', description: '厚重地形承托安静建筑；系统空间收束为有重量的精密模块。',
    island: '切削台地 / 瞭望居所 / 跨谷桥梁 / 中央工坊 / 留白花园',
    system: '层级底座 / 身份立柱 / 时间总线 / 封装核心 / 空闲插槽',
    geometry: '低至中密度。大体块、退台与深窗；系统模块以实心壳体和少量切口构成。',
    material: '岛：细砂混凝土与深色岩层。系统：哑光陶瓷壳体、石墨底座与黄铜接点。',
    highlight: '体块边缘转为琥珀色，连接线与标签同步点亮；大面积表面保持安静。',
    cost: '低。以盒体和挤出地形为主，共享材质；重点调节接触阴影与倒角。',
  },
  B: {
    title: 'B — 轻型桁架', description: '露出结构与连接方式；从悬架建筑到可读的系统骨架。',
    island: '悬挑薄板 / 架空瞭望台 / 桁架步桥 / 开放工坊 / 苗圃框架',
    system: '悬浮机架 / 身份框 / 多轨总线 / 裸露核心 / 未装配实验架',
    geometry: '高密度。细柱、梁、斜撑与悬挑；系统以空心框架替代封闭外壳。',
    material: '岛：浅色粉末涂层钢、深色板材。系统：拉丝金属轨道与半透明隔片。',
    highlight: '成组骨架边线与连接轨道变暖，标签一起响应；不靠整体发光填满场景。',
    cost: '高。杆件数量多，需合批；细线抗锯齿、透明排序与缩小后的辨识度需验证。',
  },
  C: {
    title: 'C — 层叠曲面', description: '用连续轮廓替代棱角；地貌像等高线，系统像一组精密仪器。',
    island: '等高台地 / 圆形居所 / 弧形步道 / 环形工坊 / 下沉庭园',
    system: '悬浮圆盘 / 身份环 / 环形时间总线 / 同轴核心 / 空白实验环',
    geometry: '中密度。曲面挤出、圆柱与嵌套圆环；靠层次和负空间区分四个区域。',
    material: '岛：雾白石材、磨砂灰岩。系统：缎面陶瓷圆盘、石墨环槽与琥珀接缝。',
    highlight: '曲面轮廓和环形接缝点亮，连接线与标签联动；保持低对比的内部层次。',
    cost: '中。曲面需更多分段与法线处理；同轴组件可复用，反射控制比体块更敏感。',
  },
};
const regions = [
  { id:'about', label:'关于我', sub:'身份 · 工程追求', x:-100, y:-62, lx:112, ly:130 },
  { id:'notes', label:'随笔', sub:'尚未发布正文', x:65, y:-100, lx:486, ly:148 },
  { id:'work', label:'作品集', sub:'精选 · 智能语音平台', x:8, y:5, lx:416, ly:305 },
  { id:'career', label:'职业历程', sub:'实践与项目经历', x:-60, y:100, lx:114, ly:345 },
];
const point = (x,y,z=0) => [320+(x-y)*.94,250+(x+y)*.46-z];
const points = (vertices) => vertices.map(v=>point(...v).join(',')).join(' ');
const polygon = (vertices,fill,extra='') => `<polygon class="edge" points="${points(vertices)}" fill="${fill}" stroke="#899a9b" stroke-opacity=".3" stroke-width=".7" ${extra}/>`;
function box(x,y,z,w,d,h,top='#bfc7c3',left='#536268',right='#7f8d8e') {
  return polygon([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],left)
    + polygon([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],right)
    + polygon([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top);
}
function line(a,b,color='#8a9a9d',width=1.3) {
  return `<path class="edge" d="M${point(...a)} L${point(...b)}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}
function ring(x,y,z,r,fill='#798b8e',width=2) {
  const [cx,cy]=point(x,y,z);
  return `<ellipse class="edge" cx="${cx}" cy="${cy}" rx="${r*1.33}" ry="${r*.65}" fill="${fill}" stroke="#b3bdb7" stroke-opacity=".6" stroke-width="${width}"/>`;
}
function drum(x,y,z,r,h,top='#bcc5c1',side='#57676c') {
  const [cx,cy]=point(x,y,z); const rx=r*1.33, ry=r*.65;
  return `<path class="edge" d="M${cx-rx},${cy-h} v${h} a${rx},${ry} 0 0 0 ${rx*2},0 v-${h}" fill="${side}" stroke="#899a9b" stroke-opacity=".3"/>`+ring(x,y,z+h,r,top,.8);
}
function frame(x,y,z,w,d,h) {
  let out='';
  for(const [dx,dy] of [[0,0],[w,0],[w,d],[0,d]]) out+=line([x+dx,y+dy,z],[x+dx,y+dy,z+h]);
  for(const level of [z,z+h]) out+=line([x,y,level],[x+w,y,level])+line([x+w,y,level],[x+w,y+d,level])+line([x+w,y+d,level],[x,y+d,level])+line([x,y+d,level],[x,y,level]);
  return out;
}
function object(style,world,region) {
  const {x,y,id}=region; const island=world==='island';
  if(style==='A') {
    if(id==='about' && !island) return box(x-24,y-20,0,48,40,7,'#516972')+box(x-15,y-8,7,30,16,49,'#d0d6d0')+box(x-8,y+8,20,16,2,18,'#cfaa70','#cfaa70','#cfaa70');
    if(id==='about') return box(x-18,y-18,0,36,36,56)+box(x-23,y-23,56,46,46,6)+box(x-10,y+18,24,8,1,18,'#d7ad6e','#d7ad6e','#d7ad6e');
    if(id==='work') return box(x-43,y-34,0,86,68,10,'#606f72')+box(x-30,y-26,10,60,52,island?43:32)+box(x-17,y-18,island?53:42,34,36,15,'#e1dfcf')+(island?box(x-33,y+26,12,25,3,28,'#293a43','#293a43','#293a43'):box(x-22,y-20,57,44,40,3,'#d4a25e'));
    if(id==='career') return box(x-40,y-10,0,10,20,18)+box(x+30,y-10,0,10,20,18)+box(x-43,y-13,18,86,26,7,island?'#a6b1ae':'#54696e')+[0,1,2,3,4].map(i=>box(x-35+i*16,y-5,25,7,10,3,'#d2ab71')).join('');
    return box(x-26,y-22,0,52,44,8,'#707f7b')+(island?[[-15,0],[0,-10],[13,6]].map(([dx,dy])=>box(x+dx,y+dy,8,7,7,14,'#87958a')).join(''):frame(x-16,y-12,8,32,24,5));
  }
  if(style==='B') {
    if(id==='career') return frame(x-42,y-12,6,84,24,18)+line([x-42,y+12,6],[x,y+12,24])+line([x,y+12,24],[x+42,y+12,6])+box(x-42,y-12,13,84,24,2,'#647578')+[0,1,2,3,4].map(i=>box(x-36+i*17,y-4,15,6,8,3,'#d2aa70')).join('');
    const w=id==='work'?68:38,h=id==='work'?52:id==='about'?62:22;
    let out=frame(x-w/2,y-w/2,3,w,w,h)+line([x-w/2,y+w/2,3],[x+w/2,y+w/2,h+3]);
    if(id==='notes') return out+box(x-w/2,y-w/2,0,w,w,3,'#465956');
    out+=box(x-w/2-4,y-w/2-4,h+3,w+8,w+8,3,island?'#b4bfba':'#526b73');
    out+=box(x-w/2,y-w/2,17,w,w,3,'#74888d');
    if(!island) out+=polygon([[x-w/2,y-w/2,18],[x+w/2,y-w/2,18],[x+w/2,y-w/2,h],[x-w/2,y-w/2,h]],'#91b4ba','opacity=".24"');
    if(id==='work') out+=island?box(x-20,y-18,20,35,35,19,'#a6b5b3'):frame(x-17,y-17,21,34,34,25)+box(x-9,y-9,25,18,18,16,'#d0b581');
    else out+=line([x,y,20],[x,y,h],'#d4a25e',4);
    return out;
  }
  if(id==='about') return drum(x,y,0,24,12)+drum(x,y,12,17,39)+ring(x,y,52,20,island?'#d2d6cc':'none',3)+ring(x,y,56,9,'#d4ac70',1);
  if(id==='work') return drum(x,y,0,42,10,'#74878a')+drum(x,y,12,34,17)+drum(x,y,32,25,island?16:7,'#dedfd3')+ring(x,y,island?49:46,17,'#334950',3)+ring(x,y,island?50:54,11,island?'#bda574':'none',2);
  if(id==='career') return ring(x,y,4,34,'none',7)+[0,1,2,3,4].map(i=>{const a=i*Math.PI/2.5;return drum(x+Math.cos(a)*34,y+Math.sin(a)*34,4,3,4,'#cfaa73');}).join('');
  return drum(x,y,0,26,6,'#687c79')+ring(x,y,7,19,island?'#334b46':'none',3)+ring(x,y,9,10,'none',1);
}
function ground(style,world) {
  if(style==='A') return world==='island'?box(-148,-136,-38,290,274,20,'#34454b','#202f37','#2b3b42')+box(-136,-123,-18,263,248,18,'#4b5c60','#293a43','#35474e'):box(-142,-130,-10,280,265,8,'#233640','#1c2a34','#2a3d48');
  if(style==='B') return frame(-140,-130,-28,278,264,25)+[-95,-35,25,85].map(i=>line([-140,i,-3],[138,i,-3],'#465b66',.7)).join('')+(world==='island'?box(-139,-129,-3,276,262,3,'#2d4149'):line([0,-130,-3],[0,134,-3],'#5c7782',2));
  return drum(0,0,-36,147,14,'#273c46','#1c2b33')+drum(0,0,-22,137,12,'#344a52','#283c45')+(world==='island'?drum(0,0,-10,123,10,'#4b6063','#354a53'):ring(0,0,0,123,'#142731',2));
}
function scene(style,world) {
  const materialId=`material-${style}-${world}`;
  const materials=`<defs><filter id="${materialId}-grain"><feTurbulence baseFrequency=".7" numOctaves="2" seed="7" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="soft-light"/></filter><linearGradient id="${materialId}-metal" x2="1" y2=".3"><stop stop-color="#6b858d"/><stop offset=".35" stop-color="#e0e7df"/><stop offset=".45" stop-color="#80989f"/><stop offset="1" stop-color="#acbdbb"/></linearGradient><linearGradient id="${materialId}-ceramic"><stop stop-color="#4b626c"/><stop offset=".42" stop-color="#9baaa9"/><stop offset="1" stop-color="#3d5561"/></linearGradient></defs>`;
  const objects=regions.map(region=>{
    const {id,x,y,lx,ly,label,sub}=region; const [px,py]=point(x,y);
    let geometry=object(style,world,region);
    if(style==='B') geometry=geometry.replaceAll('fill="#b4bfba"',`fill="url(#${materialId}-metal)"`).replaceAll('fill="#526b73"',`fill="url(#${materialId}-metal)"`);
    if(style==='C') geometry=geometry.replaceAll('fill="#57676c"',`fill="url(#${materialId}-ceramic)"`);
    const grain=style==='A'?`<g opacity=".1" filter="url(#${materialId}-grain)" pointer-events="none">${geometry}</g>`:'';
    return `<g class="object" data-region="${id}" tabindex="0" role="button" aria-label="比较${label}" aria-pressed="false"><path class="connector" d="M320,252 L${px},${py} L${lx},${ly-20}"/><g class="geometry">${geometry}${grain}</g><rect x="${lx-74}" y="${ly-16}" width="148" height="42" fill="transparent"/><text class="label" x="${lx}" y="${ly}" text-anchor="middle">${label}</text><text class="sub" x="${lx}" y="${ly+17}" text-anchor="middle">${sub}</text></g>`;
  }).join('');
  const [ax,ay]=point(90,105);
  return `<svg viewBox="0 0 640 440" role="group" aria-label="${world==='island'?'建筑地形小岛':'抽象系统空间'}，${candidates[style].title}">${materials}<ellipse cx="320" cy="295" rx="231" ry="105" fill="#060d14" opacity=".45"/>${ground(style,world)}<path d="M${point(-100,-62)} L${point(65,-100)} L${point(95,78)} L${point(-60,100)} Z" fill="none" stroke="#8e9a95" stroke-opacity=".25" stroke-dasharray="3 5"/>${objects}<g aria-label="主角占位"><ellipse cx="${ax}" cy="${ay}" rx="12" ry="5" fill="#09121a"/><path d="M${ax-5},${ay-4} v-17 q5,-5 10,0 v17" fill="#8d9da0"/><circle cx="${ax}" cy="${ay-29}" r="5" fill="#bfc7c2"/><text class="sub" x="${ax+19}" y="${ay-5}">主角占位</text></g></svg>`;
}
let current='A', pinned=null;
function highlight(id) {
  document.querySelectorAll('[data-region]').forEach(el=>{el.classList.toggle('active',el.dataset.region===id);el.setAttribute('aria-pressed',String(el.dataset.region===pinned));});
  const region=regions.find(r=>r.id===id);
  document.querySelector('#interaction').textContent=region?`${pinned?'已固定':'正在比较'}：${region.label} · ${region.sub}。${pinned?'再次点击取消固定。':'两种世界同步高亮。'}`:'悬停任一对象或标签，两种世界同步高亮；点击可固定比较。';
}
function render(key,updateURL=true) {
  current=Object.hasOwn(candidates,key)?key:'A'; pinned=null;
  const item=candidates[current];
  for(const field of ['title','description','geometry','material','highlight','cost']) document.getElementById(field).textContent=item[field];
  for(const world of ['island','system']) { document.getElementById(world).innerHTML=scene(current,world);document.getElementById(`${world}-note`).textContent=item[world]; }
  document.querySelectorAll('[data-variant]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.variant===current)));
  document.querySelectorAll('[data-region]').forEach(el=>{
    const id=el.dataset.region;
    el.addEventListener('pointerenter',()=>highlight(id));el.addEventListener('pointerleave',()=>highlight(pinned));
    el.addEventListener('focus',()=>highlight(id));el.addEventListener('blur',()=>highlight(pinned));
    const toggle=()=>{pinned=pinned===id?null:id;highlight(pinned);};
    el.addEventListener('click',toggle);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
  });
  highlight(null);
  if(updateURL){const url=new URL(location.href);url.searchParams.set('variant',current);history.replaceState(null,'',url);}
}
const cycle=direction=>render(['A','B','C'][(['A','B','C'].indexOf(current)+direction+3)%3]);
document.querySelector('#previous').onclick=()=>cycle(-1);
document.querySelector('#next').onclick=()=>cycle(1);
document.querySelectorAll('[data-variant]').forEach(button=>button.onclick=()=>render(button.dataset.variant));
document.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,[contenteditable]'))return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();cycle(event.key==='ArrowLeft'?-1:1);}});
window.addEventListener('popstate',()=>render(new URLSearchParams(location.search).get('variant'),false));
if(import.meta.env.PROD) document.querySelector('.switcher').hidden=true;
render(new URLSearchParams(location.search).get('variant'));
