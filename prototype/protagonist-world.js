// THROWAWAY: frozen C geometry from object-styles.js for controlled character comparison.
const point = (x,y,z=0) => [320+(x-y)*.94,250+(x+y)*.46-z];
function ring(x,y,z,r,fill='#798b8e',width=2) {
  const [cx,cy]=point(x,y,z);
  return `<ellipse class="edge" cx="${cx}" cy="${cy}" rx="${r*1.33}" ry="${r*.65}" fill="${fill}" stroke="#b3bdb7" stroke-opacity=".6" stroke-width="${width}"/>`;
}
function drum(x,y,z,r,h,top='#bcc5c1',side='#57676c') {
  const [cx,cy]=point(x,y,z); const rx=r*1.33, ry=r*.65;
  return `<path class="edge" d="M${cx-rx},${cy-h} v${h} a${rx},${ry} 0 0 0 ${rx*2},0 v-${h}" fill="${side}" stroke="#899a9b" stroke-opacity=".3"/>`+ring(x,y,z+h,r,top,.8);
}
function object(world, region) {
  const {x,y,id}=region; const island=world==='island';
  if(id==='about') return drum(x,y,0,24,12)+drum(x,y,12,17,39)+ring(x,y,52,20,island?'#d2d6cc':'none',3)+ring(x,y,56,9,'#d4ac70',1);
  if(id==='work') return drum(x,y,0,42,10,'#74878a')+drum(x,y,12,34,17)+drum(x,y,32,25,island?16:7,'#dedfd3')+ring(x,y,island?49:46,17,'#334950',3)+ring(x,y,island?50:54,11,island?'#bda574':'none',2);
  if(id==='career') return ring(x,y,4,34,'none',7)+[0,1,2,3,4].map(i=>{const a=i*Math.PI/2.5;return drum(x+Math.cos(a)*34,y+Math.sin(a)*34,4,3,4,'#cfaa73');}).join('');
  return drum(x,y,0,26,6,'#687c79')+ring(x,y,7,19,island?'#334b46':'none',3)+ring(x,y,9,10,'none',1);
}
function ground(world) {
  return drum(0,0,-36,147,14,'#273c46','#1c2b33')+drum(0,0,-22,137,12,'#344a52','#283c45')+(world==='island'?drum(0,0,-10,123,10,'#4b6063','#354a53'):ring(0,0,0,123,'#142731',2));
}

export const regions = [
  { id:'about', label:'关于我', copy:'了解我的工程实践与关注方向。' },
  { id:'career', label:'职业历程', copy:'沿着项目经历，看看一路的选择。' },
  { id:'work', label:'作品集', copy:'从智能语音平台，了解我的工程实践。' },
  { id:'notes', label:'随笔', copy:'这里留给思考与记录，目前暂无正文。' },
];
const layouts = {
  A: [{x:-100,y:-62,lx:160,ly:126},{x:-60,y:100,lx:113,ly:341},{x:8,y:5,lx:397,ly:249},{x:65,y:-100,lx:499,ly:208}],
  B: [{x:-125,y:20,lx:122,ly:164},{x:-50,y:15,lx:202,ly:277},{x:30,y:-20,lx:380,ly:192},{x:112,y:-15,lx:484,ly:323}],
};
export function worldMarkup(world, layout) {
  const placed = regions.map((region,i)=>({...region,...layouts[layout][i]}));
  const path = layout==='A' ? 'M160,192 Q320,80 481,234 Q390,378 170,323 Z' : placed.map((r,i)=>`${i?'L':'M'}${point(r.x,r.y)}`).join(' ');
  return `${ground(world)}<path d="${path}" fill="none" stroke="#778b89" stroke-width="2" opacity=".4"/>${placed.map(region=>{
    const [x,y]=point(region.x,region.y);
    return `<g class="object" data-region="${region.id}" role="button" tabindex="0" aria-label="${region.label}"><path class="connector" d="M${x},${y} L${region.lx},${region.ly-15}"/>${object(world,region)}<rect x="${region.lx-53}" y="${region.ly-17}" width="106" height="32" fill="transparent"/><text class="label" x="${region.lx}" y="${region.ly}" text-anchor="middle">${region.label}</text></g>`;
  }).join('')}`;
}
