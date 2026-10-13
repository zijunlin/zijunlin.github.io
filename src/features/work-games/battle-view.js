// Canvas owns transient combat effects; the captured satellites remain DOM artwork.
export function mountBattleView(layer) {
  const canvas = document.createElement('canvas'); canvas.className = 'game-effects'; canvas.setAttribute('aria-hidden', 'true');
  layer.prepend(canvas);
  const context = canvas.getContext('2d');
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * ratio; canvas.height = innerHeight * ratio;
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  function trajectoryMarker(x, y, size) {
    context.strokeStyle = '#78f4c4'; context.fillStyle = '#123d32'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(x, y - size); context.lineTo(x + size, y);
    context.lineTo(x, y + size); context.lineTo(x - size, y); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(x - 3, y + 2); context.lineTo(x, y - 3); context.lineTo(x + 3, y + 2); context.stroke();
  }
  function resourceMarker(kind, x, y, size) {
    if (kind === 'trajectory') { trajectoryMarker(x, y, size); return; }
    if (kind === 'fireRate') {
      // Blue lightning bolt.
      context.strokeStyle = '#6fcfff'; context.fillStyle = '#123348'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x + size * .3, y - size);
      context.lineTo(x - size * .7, y + size * .1); context.lineTo(x, y + size * .1);
      context.lineTo(x - size * .3, y + size); context.lineTo(x + size * .7, y - size * .1);
      context.lineTo(x, y - size * .1); context.closePath(); context.fill(); context.stroke(); return;
    }
    if (kind === 'movement') {
      // Yellow double chevron.
      context.strokeStyle = '#ffe178'; context.lineWidth = 2;
      for (const offset of [-size * .4, size * .4]) {
        context.beginPath(); context.moveTo(x - size * .7, y + offset + size * .4);
        context.lineTo(x, y + offset - size * .4); context.lineTo(x + size * .7, y + offset + size * .4); context.stroke();
      }
      return;
    }
    if (kind === 'piercing') {
      // Violet arrow crossing a target bar.
      context.strokeStyle = '#d2a7ff'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x, y + size); context.lineTo(x, y - size);
      context.moveTo(x - size * .6, y - size * .4); context.lineTo(x, y - size); context.lineTo(x + size * .6, y - size * .4);
      context.moveTo(x - size, y + size * .3); context.lineTo(x + size, y + size * .3); context.stroke(); return;
    }
    context.strokeStyle = '#ffbb66'; context.fillStyle = '#493018'; context.lineWidth = 2;
    context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2); context.fill(); context.stroke();
    context.beginPath(); context.arc(x, y, size * .45, 0, Math.PI * 2); context.stroke();
  }
  function draw(state, bounds) {
    if (!context) return;
    context.clearRect(0, 0, innerWidth, innerHeight);
    context.save(); context.beginPath(); context.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top); context.clip();
    for (const wave of state.shockwaves) {
      context.strokeStyle = '#9be8ff'; context.lineWidth = 3;
      context.beginPath(); context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2); context.stroke();
    }
    for (const bullet of state.bullets) {
      if (bullet.piercing) {
        // A violet elongated bolt distinguishes piercing without flashing.
        context.strokeStyle = '#d2a7ff'; context.lineWidth = 3;
        context.beginPath();
        context.moveTo(bullet.x - bullet.vx / 520 * 7, bullet.y - bullet.vy / 520 * 7);
        context.lineTo(bullet.x + bullet.vx / 520 * 3, bullet.y + bullet.vy / 520 * 3);
        context.stroke();
      } else {
        context.fillStyle = '#c9f5fa';
        context.beginPath(); context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2); context.fill();
      }
    }
    for (const obstacle of state.obstacles) {
      if (obstacle.warning > 0) {
        const x = Math.max(bounds.left + 10, Math.min(bounds.right - 10, obstacle.x));
        const y = Math.max(bounds.top + 10, Math.min(bounds.bottom - 10, obstacle.y));
        context.strokeStyle = '#f4c880'; context.lineWidth = 2;
        context.beginPath(); context.arc(x, y, 7 + (1 - obstacle.warning / .65) * 8, 0, Math.PI * 2); context.stroke();
        if (obstacle.resource) resourceMarker(obstacle.resource, x, y, 6);
        continue;
      }
      context.fillStyle = obstacle.flash ? '#fff5d7' : '#765d59aa';
      context.strokeStyle = '#dfa796'; context.lineWidth = 1.5;
      context.beginPath();
      for (let i = 0; i < 9; i++) {
        const angle = i * Math.PI * 2 / 9;
        const radius = obstacle.radius * (i % 2 ? .85 : 1);
        const x = obstacle.x + Math.cos(angle) * radius, y = obstacle.y + Math.sin(angle) * radius;
        if (i) context.lineTo(x, y); else context.moveTo(x, y);
      }
      context.closePath(); context.fill(); context.stroke();
      if (obstacle.resource) resourceMarker(obstacle.resource, obstacle.x, obstacle.y, 7);
    }
    for (const resource of state.resources) resourceMarker(resource.kind, resource.x, resource.y, 10);
    for (const particle of state.particles) {
      context.fillStyle = `rgba(255,211,155,${particle.life / .45})`;
      context.fillRect(particle.x - 1, particle.y - 1, 2, 2);
    }
    context.restore();
  }
  return { resize, draw };
}
