// THROWAWAY: three movement structures, captured from the real homepage at playback.
const $ = id => document.getElementById(id);
const canvas = $('effects'), ctx = canvas.getContext('2d'), home = $('home');
const variants = {
 A: {name:'内旋聚能', description:'弧线收束 → 加速环绕 → 飞船显现 → 整体下沉', detail:'0–0.85s 聚拢 / 0.85–1.8s 聚能 / 1.8–3s 落位'},
 B: {name:'环轨弹射', description:'切向汇入宽轨道 → 环轨蓄能 → 飞船携卫星沿弧线滑落', detail:'大半径横向环轨，强调轨道惯性与推进感'},
 C: {name:'菱形编队', description:'已选方案 · 四向收束 → 菱形旋转锁定 → 飞船展开 → 直线编队下降', detail:'几何秩序与短促停顿，强调组装和编队感'},
};
let key = new URL(location.href).searchParams.get('variant');
if (!variants[key]) key = 'C';
let width=innerWidth,height=innerHeight, points=[], copies=[], originals=[], heading;
let active=false,playing=false,time=0,last=0,ready=false,orbitTime=0;
const clamp=n=>Math.max(0,Math.min(1,n)), mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const out=t=>1-(1-clamp(t))**3;
function resize(){width=innerWidth;height=innerHeight;const d=Math.min(devicePixelRatio,2);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);if(active)reset();}
resize();addEventListener('resize',resize);
$('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateVariant(){const v=variants[key];$('variant').textContent=`${key} — ${v.name}`;$('description').textContent=v.description;$('detail').textContent=v.detail;const url=new URL(location.href);url.searchParams.set('variant',key);history.replaceState(null,'',url);}
function cycle(direction){reset();key=Object.keys(variants)[(Object.keys(variants).indexOf(key)+direction+3)%3];updateVariant();}
$('prev').onclick=()=>cycle(-1);$('next').onclick=()=>cycle(1);
addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,[contenteditable]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();cycle(e.key==='ArrowLeft'?-1:1)}if(e.key==='Escape')reset();});
function discover(){const doc=home.contentDocument;originals=[...doc.querySelectorAll('.celestial-gate')];heading=doc.querySelector('.scene-heading');if(originals.length!==4){setTimeout(discover,100);return}ready=true;$('play').disabled=false;$('phase').textContent='首页实时运动 · 等待播放';}
home.addEventListener('load',discover);
if(home.contentDocument?.readyState==='complete')discover();
// Freeze the actual rendered appearance, including the orb-art scale and
// the current halo breath. Only the outer wrapper moves and shrinks.
function snapshotArt(source){
 const clone=source.cloneNode(true);
 const from=[source,...source.querySelectorAll('*')];
 const to=[clone,...clone.querySelectorAll('*')];
 from.forEach((node,i)=>{
  const style=home.contentWindow.getComputedStyle(node);
  for(const property of style) to[i].style.setProperty(property,style.getPropertyValue(property));
  to[i].style.animation='none';
  to[i].style.transition='none';
 });
 return clone;
}
function capture(){
 points=originals.map(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,size:r.width}});
 copies=originals.map((el,i)=>{
  const copy=document.createElement('div');
  copy.className='orb-copy';
  copy.append(snapshotArt(el.querySelector('.orb-art')));
  // A separate SVG wrapper tightens only the halo, preserving the captured
  // breath transform and opacity on its descendants.
  const halo=copy.querySelector('.orb-halo');
  if(halo){
   const envelope=document.createElementNS('http://www.w3.org/2000/svg','g');
   envelope.classList.add('opening-halo-envelope');
   halo.before(envelope);envelope.append(halo);
  }
  copy.style.width=copy.style.height=`${points[i].size}px`;
  $('orbs').append(copy);
  el.style.visibility='hidden';
  return copy;
 });
 if(heading)heading.style.opacity='0';active=true;$('hud').hidden=false;
}
function reset(){active=false;playing=false;time=0;orbitTime=0;copies.forEach(el=>el.remove());copies=[];originals.forEach(el=>el.style.visibility='');if(heading)heading.style.opacity='';ctx.clearRect(0,0,width,height);$('seek').value=0;$('clock').textContent='0.00 / 3.00s';$('phase').textContent=ready?'首页实时运动 · 等待播放':'等待首页';$('play').textContent='播放开场';$('hud').hidden=true;}
$('reset').onclick=reset;
$('play').onclick=()=>{if(!ready)return;if(time>=3)reset();if(!active)capture();playing=!playing;$('play').textContent=playing?'暂停':'继续';};
$('seek').oninput=()=>{if(!ready)return;if(!active)capture();playing=false;time=Number($('seek').value);orbitTime=0;$('play').textContent='继续';draw();};
$('reduced').onchange=()=>{if(active)draw();};
function pose(i,t,orbit=0){
 const p=points[i],reduced=$('reduced').checked;
 const cx=width*.5,cy=height*.44, bottom=height-Math.max(190,height*.18);
 let descend=smooth((t-1.8)/1.2), centerX=cx,centerY=mix(cy,bottom,descend);
 if(key==='B')centerX+=Math.sin(descend*Math.PI)*width*.13;
 const initial=Math.atan2(p.y-cy,p.x-cx), gather=out(t/.85);
 let angle=initial+smooth((t-.55)/1.25)*Math.PI*(key==='B'?2.1:key==='C'?.5:2.6);
 let radius=mix(key==='B'?100:key==='C'?62:58,30, smooth((t-1.4)/1.3));
 let x,y;
 if(key==='C')angle=mix(initial,i*Math.PI/2-Math.PI/2,smooth(t/.85))+smooth((t-.85)/.9)*Math.PI/2;
 angle+=orbit*Math.PI/3;
 const targetX=centerX+Math.cos(angle)*radius,targetY=centerY+Math.sin(angle)*radius*(key==='B'?.48:1);
 x=mix(p.x,targetX,gather);y=mix(p.y,targetY,gather);
 // Bow the inward path without changing its start or endpoint.
 if(key==='A'){x+=Math.sin(gather*Math.PI)*(p.y-cy)*.35;y-=Math.sin(gather*Math.PI)*(p.x-cx)*.18;}
 if(reduced){x=mix(p.x,cx+Math.cos(i*Math.PI/2)*30,smooth(t/3));y=mix(p.y,bottom+Math.sin(i*Math.PI/2)*30,smooth(t/3));}
 return {x,y,scale:mix(1, .65, smooth(t/1.7)),centerX,centerY};
}
function ship(x,y,alpha,t){
 if(alpha<=0)return;ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;
 const size=(key==='C'?1.1:1)*.5;ctx.scale(size,size);
 ctx.shadowColor='#8de9f0';ctx.shadowBlur=16;ctx.fillStyle='#a7e9ed';
 ctx.beginPath();ctx.moveTo(0,-26);ctx.lineTo(19,19);ctx.lineTo(7,13);ctx.lineTo(0,19);ctx.lineTo(-7,13);ctx.lineTo(-19,19);ctx.closePath();ctx.fill();
 ctx.shadowBlur=0;ctx.fillStyle='#163a49';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(6,9);ctx.lineTo(0,5);ctx.lineTo(-6,9);ctx.closePath();ctx.fill();
 ctx.fillStyle='#e5ffff';ctx.fillRect(-2,-6,4,9);
 if(!$('reduced').checked){const flame=14+Math.sin(t*55)*4;const g=ctx.createLinearGradient(0,18,0,18+flame);g.addColorStop(0,'#a0edff');g.addColorStop(1,'#76c8ff00');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-5,18);ctx.lineTo(0,18+flame);ctx.lineTo(5,18);ctx.fill();}ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,width,height);if(!active)return;
 const reduced=$('reduced').checked;
 copies.forEach((el,i)=>{const p=pose(i,time,orbitTime);
 const halo=el.querySelector('.opening-halo-envelope');
 if(halo){const shrink=mix(1,.45,smooth(time/1.7));halo.setAttribute('transform',`translate(100 100) scale(${shrink}) translate(-100 -100)`);}
 el.style.transform=`translate(${p.x-points[i].size/2}px,${p.y-points[i].size/2}px) scale(${p.scale})`;
 if(!reduced&&time>0&&time<2.95){ctx.beginPath();for(let j=0;j<24;j++){const q=pose(i,Math.max(0,time-j*.011));j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)}ctx.strokeStyle='#9bdde64a';ctx.lineWidth=1.4;ctx.stroke();}
 });
 const p=pose(0,time),reveal=smooth((time-1.25)/.55);
 const y=reduced?height-Math.max(190,height*.18):p.centerY;
 if(!reduced){const pulse=Math.sin(clamp((time-1.05)/1.15)*Math.PI);ctx.save();ctx.globalAlpha=pulse*.55;ctx.strokeStyle='#acebef';ctx.lineWidth=1;ctx.beginPath();ctx.arc(width*.5,height*.44,18+smooth((time-1.05)/1.15)*65,0,Math.PI*2);ctx.stroke();ctx.restore();}
 ship(reduced?width*.5:p.centerX,y,reduced?smooth((time-2)/1):reveal,time);
 $('clock').textContent=`${time.toFixed(2)} / 3.00s`;$('seek').value=time;
 $('phase').textContent=time>=3?'飞船就位 · 卫星持续环绕（6 秒 / 圈）':reduced?'简化过渡':time<.85?'01 / 从当前位置聚拢':time<1.8?'02 / 环绕聚能 · 飞船显现':'03 / 携卫星落位';
}
function frame(now){
 const delta=Math.min((now-last)/1000,.05)*Number($('speed').value);
 if(playing){
  time=Math.min(3,time+delta);
  if(time===3){playing=false;$('play').textContent='重新播放';}
 }
 // Reduced-motion mode retains the simplified, stationary formation.
 if(active&&time===3&&!document.hidden&&!$('reduced').checked)orbitTime+=delta;
 if(active)draw();
 last=now;requestAnimationFrame(frame);
}updateVariant();requestAnimationFrame(frame);
if(import.meta.env.PROD)$('controls').hidden=true;
