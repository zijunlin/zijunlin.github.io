const clamp = value => Math.max(0, Math.min(1, value));
const blend = (from, to, progress) => from + (to - from) * progress;
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Render the approved diamond formation using captured viewport coordinates.
export function mountOpening(layer, captures, reduced) {
  const satellites = captures.map(capture => {
    const element = document.createElement('div');
    element.className = 'game-satellite';
    element.style.width = element.style.height = `${capture.size}px`;
    element.append(capture.art);
    const halo = element.querySelector('.orb-halo');
    const envelope = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    halo.before(envelope); envelope.append(halo);
    layer.append(element);
    return { element, envelope };
  });
  const ship = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ship.classList.add('game-ship');
  ship.setAttribute('viewBox', '-24 -30 48 72');
  ship.innerHTML = '<path fill="#a7e9ed" d="M0-26 19 19 7 13 0 19-7 13-19 19Z"/><path fill="#163a49" d="M0-13 6 9 0 5-6 9Z"/><path fill="#e5ffff" d="M-2-6H2V3H-2Z"/><path fill="#8de9f080" d="M-5 18 0 34 5 18Z"/>';
  layer.append(ship);
  function render(time, orbitTime, bounds, center) {
    const down = ease((time - 1.8) / 1.2);
    const cx = (bounds.left + bounds.right) / 2;
    const cy = Math.max(bounds.top + 62, (bounds.bottom + 20) * .44);
    const shipX = center?.x ?? cx;
    const shipY = center?.y ?? blend(cy, bounds.bottom - 45, down);
    satellites.forEach(({ element, envelope }, i) => {
      const capture = captures[i];
      const startAngle = Math.atan2(capture.y - cy, capture.x - cx);
      const angle = blend(startAngle, i * Math.PI / 2 - Math.PI / 2, ease(time / .85))
        + ease((time - .85) / .9) * Math.PI / 2 + (reduced ? 0 : orbitTime * Math.PI / 3);
      const radius = blend(62, 30, ease((time - 1.4) / 1.3));
      const gather = 1 - (1 - clamp(time / .85)) ** 3;
      const x = reduced ? blend(capture.x, shipX + Math.cos(i * Math.PI / 2) * 30, ease(time / 3))
        : blend(capture.x, shipX + Math.cos(angle) * radius, gather);
      const y = reduced ? blend(capture.y, (center?.y ?? bounds.bottom - 45) + Math.sin(i * Math.PI / 2) * 30, ease(time / 3))
        : blend(capture.y, shipY + Math.sin(angle) * radius, gather);
      element.style.transform = `translate(${x - capture.size / 2}px, ${y - capture.size / 2}px) scale(${blend(1, .65, ease(time / 1.7))})`;
      envelope.setAttribute('transform', `translate(100 100) scale(${blend(1, .45, ease(time / 1.7))}) translate(-100 -100)`);
    });
    ship.style.transform = `translate(${shipX - 13.2}px, ${shipY - 16.5}px)`;
    ship.style.opacity = String(ease((time - 1.25) / .55));
  }
  return { render };
}
