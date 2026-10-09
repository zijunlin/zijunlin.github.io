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
export function hitObstacle(obstacle) {
  if (obstacle.hp <= 0) return 0;
  obstacle.hp--;
  return obstacle.hp === 0 ? obstacle.points : 0;
}
