import { createSprite } from './sprites.js';
import { advanceMotion } from './motion.js';
import { sweepContact } from './rules.js';

const ordinary = { speed: 520, radius: 2, life: 1.9, damage: 1, maxHits: 1, piercing: false };
export const projectileProfiles = {
  ordinary,
  piercing: { ...ordinary, maxHits: 2, piercing: true },
};
// Each shot snapshots its profile; later upgrades do not change shots in flight.
export function createProjectile({ x, y, angle, profile = projectileProfiles.ordinary }) {
  const { speed, radius, life, damage, maxHits, piercing } = profile;
  return { ...createSprite({ x, y, radius, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }),
    life, damage, maxHits, piercing, hitTargets: new Set() };
}

// Targets expose their position before this step. Settlement stays with battle
// so projectiles and shockwaves share one kill/score/drop path.
export function advanceProjectile(bullet, dt, obstacles, settleHit) {
  const before = { x: bullet.x, y: bullet.y };
  const liveFor = Math.min(dt, bullet.life);
  if (liveFor <= 0) return;
  advanceMotion(bullet, liveFor);
  bullet.life -= dt;
  const contacts = [];
  const fraction = liveFor / dt;
  for (const obstacle of obstacles) {
    if (obstacle.warning > 0 || obstacle.hp <= 0 || bullet.hitTargets.has(obstacle)) continue;
    const obstacleEnd = { x: obstacle.before.x + (obstacle.x - obstacle.before.x) * fraction, y: obstacle.before.y + (obstacle.y - obstacle.before.y) * fraction };
    const time = sweepContact(before, bullet, obstacle.before, obstacleEnd, obstacle.radius + bullet.radius);
    if (time !== null) contacts.push({ obstacle, time });
  }
  contacts.sort((a, b) => a.time - b.time);
  for (const { obstacle } of contacts) {
    if (!settleHit(obstacle, bullet.damage)) continue;
    bullet.hitTargets.add(obstacle);
    if (bullet.hitTargets.size >= bullet.maxHits) { bullet.life = 0; break; }
  }
}
