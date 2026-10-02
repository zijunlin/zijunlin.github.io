// Shared prototype artwork; the integrated world uses selected candidate C.
export function character(key) {
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
