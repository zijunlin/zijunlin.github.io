// Sprite positions and collision radii use CSS px. vx/vy are the velocity
// vector in CSS px/s (both direction and actual speed), never size multipliers.
// Entity-specific behavior and properties stay in the battle simulation.
export function createSprite({ x, y, radius, vx = 0, vy = 0 }) {
  return { x, y, vx, vy, radius };
}

export function moveSprite(sprite, seconds) {
  sprite.x += sprite.vx * seconds;
  sprite.y += sprite.vy * seconds;
}
