import { difficultyAt, hitObstacle, intersectsSweep } from './rules.js';
const types = [
  { radius: 12, hp: 1, points: 10, speed: 1.45 },
  { radius: 21, hp: 3, points: 30, speed: 1 },
  { radius: 30, hp: 5, points: 60, speed: .7 },
];
const STEP = 1 / 120;
const constrain = (n, low, high) => Math.max(low, Math.min(high, n));

// A deterministic simulation: only advancing an unpaused battle consumes time.
export function createBattle({ bounds, random = Math.random, reducedMotion = false }) {
  const state = { seconds: 0, score: 0, ended: false, ship: { x: (bounds.left + bounds.right) / 2, y: bounds.bottom - 45 }, bullets: [], obstacles: [], particles: [] };
  let paused = false, remainder = 0, shotWait = 0, spawnWait = 1;
  function spawn() {
    if (state.obstacles.length >= 45) return;
    const type = types[Math.floor(random() * 3)];
    let x, y, valid = false;
    for (let attempt = 0; attempt < 16; attempt++) {
      const side = Math.floor(random() * 4), along = random();
      x = side === 0 ? bounds.left - type.radius : side === 1 ? bounds.right + type.radius : bounds.left + (bounds.right - bounds.left) * along;
      y = side === 2 ? bounds.top - type.radius : side === 3 ? bounds.bottom + type.radius : bounds.top + (bounds.bottom - bounds.top) * along;
      if (Math.hypot(x - state.ship.x, y - state.ship.y) >= 210) { valid = true; break; }
    }
    if (!valid) return;
    const heading = Math.atan2(state.ship.y - y, state.ship.x - x) + (random() - .5) * .9;
    const velocity = (32 + random() * 20 + difficultyAt(state.seconds).level * 9) * type.speed;
    state.obstacles.push({ ...type, x, y, vx: Math.cos(heading) * velocity, vy: Math.sin(heading) * velocity, warning: .65, flash: 0 });
  }
  function fire() {
    const { x, y } = state.ship;
    const shot = (x, y, angle) => state.bullets.push({ x, y, vx: Math.cos(angle) * 520, vy: Math.sin(angle) * 520, life: 1.9 });
    shot(x - 5, y - 12, -Math.PI / 2); shot(x + 5, y - 12, -Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + (reducedMotion ? 0 : state.seconds * Math.PI / 3);
      shot(x + Math.cos(angle) * 30, y + Math.sin(angle) * 30, angle);
    }
  }
  // All attacks settle here, so a destroyed target cannot award another kill.
  function settleHit(obstacle, damage) {
    if (obstacle.warning > 0 || obstacle.hp <= 0) return false;
    obstacle.flash = .12;
    const points = hitObstacle(obstacle, damage);
    state.score += points;
    if (obstacle.hp === 0) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        state.particles.push({ x: obstacle.x, y: obstacle.y, vx: Math.cos(angle) * 80, vy: Math.sin(angle) * 80, life: .45 });
      }
    }
    return true;
  }
  function step(dt, input) {
    state.seconds += dt;
    const shipBefore = { ...state.ship };
    const magnitude = Math.max(1, Math.hypot(input.x, input.y));
    state.ship.x = constrain(state.ship.x + input.x / magnitude * 300 * dt, bounds.left + 38, bounds.right - 38);
    state.ship.y = constrain(state.ship.y + input.y / magnitude * 300 * dt, bounds.top + 38, bounds.bottom - 38);
    shotWait -= dt;
    if (shotWait <= 0) { fire(); shotWait += .16; }
    spawnWait -= dt;
    if (spawnWait <= 0) { spawn(); spawnWait += difficultyAt(state.seconds).interval; }
    for (const obstacle of state.obstacles) {
      obstacle.before = { x: obstacle.x, y: obstacle.y };
      obstacle.flash = Math.max(0, obstacle.flash - dt);
      if (obstacle.warning > 0) { obstacle.warning = Math.max(0, obstacle.warning - dt); continue; }
      obstacle.x += obstacle.vx * dt; obstacle.y += obstacle.vy * dt;
    }
    for (const bullet of state.bullets) {
      const before = { x: bullet.x, y: bullet.y };
      const liveFor = Math.min(dt, bullet.life);
      bullet.x += bullet.vx * liveFor; bullet.y += bullet.vy * liveFor; bullet.life -= dt;
      for (const obstacle of state.obstacles) {
        if (liveFor <= 0) continue;
        const fraction = liveFor / dt;
        const obstacleEnd = { x: obstacle.before.x + (obstacle.x - obstacle.before.x) * fraction, y: obstacle.before.y + (obstacle.y - obstacle.before.y) * fraction };
        if (!intersectsSweep(before, bullet, obstacle.before, obstacleEnd, obstacle.radius + 2)) continue;
        if (!settleHit(obstacle, 1)) continue;
        bullet.life = 0;
        break;
      }
    }
    // Resolve attacks first: a kill in this step protects the ship from that target.
    for (const obstacle of state.obstacles) {
      if (obstacle.hp > 0 && obstacle.warning <= 0 && intersectsSweep(shipBefore, state.ship, obstacle.before, obstacle, obstacle.radius + 4)) state.ended = true;
    }
    const inside = (object, margin) => object.x >= bounds.left - margin && object.x <= bounds.right + margin && object.y >= bounds.top - margin && object.y <= bounds.bottom + margin;
    state.bullets = state.bullets.filter(bullet => bullet.life > 0 && inside(bullet, 50));
    state.obstacles = state.obstacles.filter(obstacle => obstacle.hp > 0 && inside(obstacle, 90));
    for (const particle of state.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
    state.particles = state.particles.filter(particle => particle.life > 0);
  }
  return {
    state,
    advance(seconds, input = { x: 0, y: 0 }) {
      if (paused || state.ended) return;
      remainder += seconds;
      while (remainder + 1e-10 >= STEP && !state.ended) { step(STEP, input); remainder -= STEP; }
    },
    setPaused(value) { paused = value; },
    resize(next) {
      bounds = next;
      state.ship.x = constrain(state.ship.x, bounds.left + 38, bounds.right - 38);
      state.ship.y = constrain(state.ship.y, bounds.top + 38, bounds.bottom - 38);
    },
  };
}
