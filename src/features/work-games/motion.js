import { moveSprite } from './sprites.js';

// Motion changes position/velocity only. Battle owns warning, lifetime,
// collision ordering, bounds and collection. Descriptors remain serializable.
const behaviors = {
  linear(sprite, seconds) { moveSprite(sprite, seconds); },
  attraction(sprite, seconds, { target }) {
    const { speed, range } = sprite.motion;
    const dx = target.x - sprite.x, dy = target.y - sprite.y;
    const distance = Math.hypot(dx, dy);
    sprite.vx = 0; sprite.vy = 0;
    if (!distance || distance > range) return;
    sprite.vx = dx / distance * speed;
    sprite.vy = dy / distance * speed;
    // Stop at the target instead of overshooting within one simulation step.
    moveSprite(sprite, speed ? Math.min(distance, speed * seconds) / speed : 0);
  },
};
export function advanceMotion(sprite, seconds, context) {
  if (!Object.hasOwn(behaviors, sprite.motion.kind)) throw new Error(`Unknown motion: ${sprite.motion.kind}`);
  behaviors[sprite.motion.kind](sprite, seconds, context);
}
