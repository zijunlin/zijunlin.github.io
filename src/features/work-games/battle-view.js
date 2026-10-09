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
  function weaponMarker(x, y, size) {
    context.strokeStyle = '#78f4c4'; context.fillStyle = '#123d32'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(x, y - size); context.lineTo(x + size, y);
    context.lineTo(x, y + size); context.lineTo(x - size, y); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(x - 3, y + 2); context.lineTo(x, y - 3); context.lineTo(x + 3, y + 2); context.stroke();
  }
  function resourceMarker(kind, x, y, size) {
    if (kind === 'weapon') { weaponMarker(x, y, size); return; }
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
    context.fillStyle = '#c9f5fa';
    for (const bullet of state.bullets) {
      context.beginPath(); context.arc(bullet.x, bullet.y, 2, 0, Math.PI * 2); context.fill();
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
