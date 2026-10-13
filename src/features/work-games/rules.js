// Keep the visible hull in the activity area; satellites may extend outside it.
// Both simulated movement and accumulated touch targets share this boundary.
export function constrainShipPosition(position, bounds) {
  return {
    x: Math.max(bounds.left + 13.2, Math.min(bounds.right - 13.2, position.x)),
    y: Math.max(bounds.top + 16.5, Math.min(bounds.bottom - 23.1, position.y)),
  };
}

// Earliest contact on relative motion, including a target moving during the step.
export function sweepContact(a0, a1, b0, b1, radius) {
  const x = a0.x - b0.x, y = a0.y - b0.y;
  const dx = a1.x - a0.x - b1.x + b0.x, dy = a1.y - a0.y - b1.y + b0.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  const b = x * dx + y * dy;
  const discriminant = b * b - a * c;
  if (!a || b >= 0 || discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}
// Relative swept segments include both objects' motion, preventing tunnelling.
export function intersectsSweep(a0, a1, b0, b1, radius) {
  const x = a0.x - b0.x, y = a0.y - b0.y;
  const dx = a1.x - a0.x - b1.x + b0.x, dy = a1.y - a0.y - b1.y + b0.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length)) : 0;
  return (x + dx * t) ** 2 + (y + dy * t) ** 2 <= radius ** 2;
}
export function difficultyAt(seconds) {
  return { level: Math.min(5, Math.floor(seconds / 9)), interval: Math.max(.28, 1 - seconds * .016) };
}
export function hitObstacle(obstacle, damage = 1) {
  if (obstacle.hp <= 0) return 0;
  obstacle.hp = Math.max(0, obstacle.hp - damage);
  return obstacle.hp === 0 ? obstacle.points : 0;
}
