const clamp = value => Math.max(0, Math.min(1, value));
const blend = (from, to, progress) => from + (to - from) * progress;
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Render the approved diamond formation using captured viewport coordinates.
function mountArtwork(layer, captures, reduced) {
  const satellites = captures.map(capture => {
    const element = document.createElement('div');
    element.className = 'game-satellite';
    element.style.width = element.style.height = `${capture.size}px`;
    element.append(capture.art);
    layer.append(element);
    return { element };
  });
  const ship = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ship.classList.add('game-ship');
  ship.setAttribute('viewBox', '-24 -30 48 72');
  ship.innerHTML = '<path fill="#a7e9ed" d="M0-26 19 19 7 13 0 19-7 13-19 19Z"/><path fill="#163a49" d="M0-13 6 9 0 5-6 9Z"/><path fill="#e5ffff" d="M-2-6H2V3H-2Z"/><path fill="#8de9f080" d="M-5 18 0 34 5 18Z"/>';
  layer.append(ship);
  let appearanceTime = -1, bank = 0;
  function render(time, orbitTime, bounds, center, dt = 0) {
    const appearanceChanged = time !== appearanceTime;
    const down = ease((time - 1.8) / 1.2);
    const cx = (bounds.left + bounds.right) / 2;
    const cy = Math.max(bounds.top + 62, (bounds.bottom + 20) * .44);
    const shipX = center?.x ?? cx;
    const shipY = center?.y ?? blend(cy, bounds.bottom - 45, down);
    satellites.forEach(({ element }, i) => {
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
      if (appearanceChanged) capture.setEnvelopeScale(blend(1, .45, ease(time / 1.7)));
    });
    const desired = reduced ? 0 : Math.max(-1, Math.min(1, (center?.vx ?? 0) / (center?.movementSpeed || 390)));
    bank += (desired - bank) * (1 - Math.exp(-dt * 14));
    ship.style.transform = `translate(${shipX - 13.2}px, ${shipY - 16.5}px) perspective(160px) rotateY(${bank * 28}deg) rotateZ(${bank * 10}deg)`;
    if (appearanceChanged) ship.style.opacity = String(ease((time - 1.25) / .55));
    appearanceTime = time;
  }
  function returning(progress, startTime, orbitTime, bounds, center, targets) {
    // Reverse the same gathering curve while unwinding the current battle orbit.
    const remaining = 1 - ease(progress);
    captures.forEach((capture, i) => {
      if (capture.size !== targets[i].size) {
        satellites[i].element.style.width = satellites[i].element.style.height = `${targets[i].size}px`;
      }
      Object.assign(capture, targets[i]);
    });
    const time = startTime * remaining;
    const cx = (bounds.left + bounds.right) / 2;
    const cy = Math.max(bounds.top + 62, (bounds.bottom + 20) * .44);
    const y = blend(cy, bounds.bottom - 45, ease((time - 1.8) / 1.2));
    render(time, orbitTime * remaining, bounds, center ? {
      x: blend(cx, center.x, remaining), y: blend(y, center.y, remaining),
    } : undefined);
    ship.style.opacity = String((1 - ease(progress / .4)) * ease((startTime - 1.25) / .55));
  }
  return { render, returning, remove() { satellites.forEach(({ element }) => element.remove()); ship.remove(); } };
}

// Own the complete visual handoff; the game supplies time, its arena and formation.
// No independent animation loop or completion callback can outlive disposal.
export function mountGamePerformance({ layer, presentation, reduced }) {
  const captures = presentation.satellites;
  const artwork = mountArtwork(layer, captures, reduced);
  let phase = 'opening', elapsed = 0, formation, returnElapsed = 0, disposed = false;
  return {
    advance(dt, bounds, battle) {
      if (disposed) return 'disposed';
      if (phase === 'returning') {
        returnElapsed += dt;
        const progress = Math.min(1, returnElapsed / (reduced ? .25 : 1.5));
        artwork.returning(progress, elapsed, (formation?.seconds ?? 0) % 6, bounds, formation?.ship, presentation.returnTargets());
        if (progress === 1) phase = 'returned';
      } else if (phase !== 'returned') {
        if (battle) {
          elapsed = 3;
          formation = { seconds: battle.seconds, ship: { ...battle.ship } };
        } else elapsed = Math.min(3, elapsed + dt);
        artwork.render(elapsed, formation?.seconds ?? 0, bounds, formation?.ship, dt);
        if (elapsed === 3) phase = 'ready';
      }
      return phase;
    },
    returnHome() {
      if (disposed || phase === 'returning' || phase === 'returned') return;
      phase = 'returning'; returnElapsed = 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      artwork.remove(); presentation.dispose();
    },
  };
}
