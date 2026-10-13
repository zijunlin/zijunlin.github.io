import { drawPickupMarker } from './pickup-presentation.js';
// Canvas owns transient combat effects; the captured satellites remain DOM artwork.
export function mountBattleView(layer, scale = 1) {
  const canvas = document.createElement('canvas'); canvas.className = 'game-effects'; canvas.setAttribute('aria-hidden', 'true');
  layer.prepend(canvas);
  const context = canvas.getContext('2d');
  function resize() {
    // The parent applies world scale; rasterize at screen density, not world density.
    const ratio = Math.min(devicePixelRatio || 1, 2) * scale;
    canvas.width = innerWidth / scale * ratio; canvas.height = innerHeight / scale * ratio;
    canvas.style.width = `${innerWidth / scale}px`; canvas.style.height = `${innerHeight / scale}px`;
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  function draw(state, bounds) {
    if (!context) return;
    context.clearRect(0, 0, innerWidth / scale, innerHeight / scale);
    context.save(); context.beginPath(); context.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top); context.clip();
    for (const wave of state.shockwaves) {
      context.strokeStyle = '#9be8ff'; context.lineWidth = 3;
      context.beginPath(); context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2); context.stroke();
    }
    for (const bullet of state.bullets) {
      if (bullet.piercing) {
        // A violet elongated bolt distinguishes piercing without flashing.
        context.strokeStyle = '#d2a7ff'; context.lineWidth = 3;
        const speed = Math.hypot(bullet.vx, bullet.vy);
        const dx = speed ? bullet.vx / speed : 0, dy = speed ? bullet.vy / speed : -1;
        context.beginPath();
        context.moveTo(bullet.x - dx * 7, bullet.y - dy * 7);
        context.lineTo(bullet.x + dx * 3, bullet.y + dy * 3);
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
        context.strokeStyle = obstacle.fast ? '#fff07a' : '#f4c880'; context.lineWidth = obstacle.fast ? 3 : 2;
        context.beginPath(); context.arc(x, y, 7 + (1 - obstacle.warning / .65) * 8, 0, Math.PI * 2); context.stroke();
        if (obstacle.resource) drawPickupMarker(context, obstacle.resource, x, y, 6);
        continue;
      }
      if (obstacle.fast) {
        // A fixed short wake and bright contour remain legible with reduced motion.
        const speed = Math.hypot(obstacle.vx, obstacle.vy);
        const dx = speed ? obstacle.vx / speed : 0, dy = speed ? obstacle.vy / speed : 0;
        context.strokeStyle = '#fff07a'; context.lineWidth = 2;
        for (const side of [-1, 1]) {
          const x = obstacle.x - dx * obstacle.radius * .6 - dy * side * obstacle.radius * .45;
          const y = obstacle.y - dy * obstacle.radius * .6 + dx * side * obstacle.radius * .45;
          context.beginPath(); context.moveTo(x, y); context.lineTo(x - dx * 18, y - dy * 18); context.stroke();
        }
      }
      context.fillStyle = obstacle.flash ? '#fff5d7' : '#765d59aa';
      context.strokeStyle = obstacle.fast ? '#fff07a' : '#dfa796'; context.lineWidth = obstacle.fast ? 3 : 1.5;
      context.beginPath();
      for (let i = 0; i < 9; i++) {
        const angle = i * Math.PI * 2 / 9;
        const radius = obstacle.radius * (i % 2 ? .85 : 1);
        const x = obstacle.x + Math.cos(angle) * radius, y = obstacle.y + Math.sin(angle) * radius;
        if (i) context.lineTo(x, y); else context.moveTo(x, y);
      }
      context.closePath(); context.fill(); context.stroke();
      if (obstacle.resource) drawPickupMarker(context, obstacle.resource, obstacle.x, obstacle.y, 7);
    }
    for (const resource of state.resources) drawPickupMarker(context, resource.kind, resource.x, resource.y, 10);
    for (const particle of state.particles) {
      context.fillStyle = `rgba(255,211,155,${particle.life / .45})`;
      context.fillRect(particle.x - 1, particle.y - 1, 2, 2);
    }
    context.restore();
  }
  return { resize, draw };
}
