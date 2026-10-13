import { createSprite, moveSprite } from './sprites.js';
import { difficultyAt, hitObstacle, intersectsSweep, sweepContact } from './rules.js';
const types = [
  { radius: 12, hp: 1, points: 10, sizeSpeedMultiplier: 1.45 },
  { radius: 21, hp: 3, points: 30, sizeSpeedMultiplier: 1 },
  { radius: 30, hp: 5, points: 60, sizeSpeedMultiplier: .7 },
];
// First-pass tuning: 110px attraction, 720px/s pull, 16px collection, ±6° fan; max-level weapon drops award 50 points.
const RESOURCE = { lifetime: 8, attraction: 110, speed: 720, pickup: 16, feedback: 1.2, edgeInset: 12, maxWeaponPoints: 50 };
const FAN_ANGLE = Math.PI / 30;
// Visible ship viewport, excluding the orbiting satellites.
const shipInsets = { left: 13.2, right: 13.2, top: 16.5, bottom: 23.1 };
const STEP = 1 / 120;
const SHOCKWAVE = { radius: 220, duration: .5, damage: 3 };
const constrain = (n, low, high) => Math.max(low, Math.min(high, n));

// A deterministic simulation: only advancing an unpaused battle consumes time.
export function createBattle({ bounds, random = Math.random, reducedMotion = false }) {
  const state = { seconds: 0, score: 0, ended: false, ship: { ...createSprite({ x: (bounds.left + bounds.right) / 2, y: bounds.bottom - 45, radius: 4 }), movementSpeed: 390 }, bullets: [], obstacles: [], particles: [], resources: [], weaponLevel: 0, pickupFeedback: 0, pickupKind: null, pickupScore: 0, shockwaveCharges: 1, shockwaves: [] };
  let paused = false, remainder = 0, shotWait = 0, satelliteWait = 0, spawnWait = 1, generated = 0, shockwaveHeld = false, shockwavePending = false;
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
    const baseVelocity = (32 + random() * 20 + difficultyAt(state.seconds).level * 9) * type.sizeSpeedMultiplier;
    const fast = state.seconds >= 9 && random() < .15;
    const velocity = baseVelocity * (fast ? 2 : 1);
    generated++;
    state.obstacles.push({ ...type, fast, ...createSprite({ x, y, radius: type.radius, vx: Math.cos(heading) * velocity, vy: Math.sin(heading) * velocity }), resource: generated % 4 === 0 ? (generated % 12 === 0 ? 'shockwave' : 'weapon') : null, warning: .65, flash: 0 });
  }
  function shot(x, y, angle, piercing = false) {
    state.bullets.push({ ...createSprite({ x, y, radius: 2, vx: Math.cos(angle) * 520, vy: Math.sin(angle) * 520 }), life: 1.9, piercing, hitTargets: new Set() });
  }
  function fireForward() {
    const { x, y } = state.ship;
    if (state.weaponLevel === 0) {
      shot(x - 5, y - 12, -Math.PI / 2); shot(x + 5, y - 12, -Math.PI / 2);
    } else {
      for (const offset of state.weaponLevel >= 4 ? [-FAN_ANGLE, -FAN_ANGLE / 3, FAN_ANGLE / 3, FAN_ANGLE] : [-FAN_ANGLE, 0, FAN_ANGLE]) shot(x, y - 12, -Math.PI / 2 + offset, state.weaponLevel >= 3);
    }
  }
  function fireSatellites() {
    const { x, y } = state.ship;
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
      if (obstacle.resource) state.resources.push({ ...createSprite({ x: constrain(obstacle.x, bounds.left + RESOURCE.edgeInset, bounds.right - RESOURCE.edgeInset), y: constrain(obstacle.y, bounds.top + RESOURCE.edgeInset, bounds.bottom - RESOURCE.edgeInset), radius: RESOURCE.pickup }), kind: obstacle.resource, life: RESOURCE.lifetime });
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        state.particles.push({ x: obstacle.x, y: obstacle.y, vx: Math.cos(angle) * 80, vy: Math.sin(angle) * 80, life: .45 });
      }
    }
    return true;
  }
  function step(dt, input) {
    state.seconds += dt;
    if (shockwavePending && state.shockwaveCharges > 0) {
      state.shockwaveCharges--;
      state.shockwaves.push({ x: state.ship.x, y: state.ship.y, radius: 0, age: 0, hitTargets: new Set() });
    }
    shockwavePending = false;
    const shipBefore = { ...state.ship };
    const magnitude = Math.max(1, Math.hypot(input.x, input.y));
    state.ship.vx = input.x / magnitude * state.ship.movementSpeed;
    state.ship.vy = input.y / magnitude * state.ship.movementSpeed;
    moveSprite(state.ship, dt);
    state.ship.x = constrain(state.ship.x, bounds.left + shipInsets.left, bounds.right - shipInsets.right);
    state.ship.y = constrain(state.ship.y, bounds.top + shipInsets.top, bounds.bottom - shipInsets.bottom);
    shotWait -= dt;
    // Upgrades preserve the pending wait; the next volley starts the new cadence.
    if (shotWait <= 0) { fireForward(); shotWait += state.weaponLevel >= 4 ? .11 : state.weaponLevel >= 2 ? .13 : .16; }
    satelliteWait -= dt;
    if (satelliteWait <= 0) { fireSatellites(); satelliteWait += .16; }
    spawnWait -= dt;
    if (spawnWait <= 0) { spawn(); spawnWait += difficultyAt(state.seconds).interval; }
    for (const obstacle of state.obstacles) {
      obstacle.before = { x: obstacle.x, y: obstacle.y };
      obstacle.flash = Math.max(0, obstacle.flash - dt);
      if (obstacle.warning > 0) { obstacle.warning = Math.max(0, obstacle.warning - dt); continue; }
      moveSprite(obstacle, dt);
    }
    for (const bullet of state.bullets) {
      const before = { x: bullet.x, y: bullet.y };
      const liveFor = Math.min(dt, bullet.life);
      moveSprite(bullet, liveFor); bullet.life -= dt;
      if (liveFor <= 0) continue;
      const contacts = [];
      const fraction = liveFor / dt;
      for (const obstacle of state.obstacles) {
        if (obstacle.warning > 0 || obstacle.hp <= 0 || bullet.hitTargets.has(obstacle)) continue;
        const obstacleEnd = { x: obstacle.before.x + (obstacle.x - obstacle.before.x) * fraction, y: obstacle.before.y + (obstacle.y - obstacle.before.y) * fraction };
        const time = sweepContact(before, bullet, obstacle.before, obstacleEnd, obstacle.radius + bullet.radius);
        if (time !== null) contacts.push({ obstacle, time });
      }
      contacts.sort((a, b) => a.time - b.time);
      for (const { obstacle } of contacts) {
        if (!settleHit(obstacle, 1)) continue;
        bullet.hitTargets.add(obstacle);
        if (bullet.hitTargets.size >= (bullet.piercing ? 2 : 1)) { bullet.life = 0; break; }
      }
    }
    for (const wave of state.shockwaves) {
      wave.age += dt;
      wave.radius = SHOCKWAVE.radius * Math.min(1, wave.age / SHOCKWAVE.duration);
      for (const obstacle of state.obstacles) {
        if (wave.hitTargets.has(obstacle) || Math.hypot(obstacle.x - wave.x, obstacle.y - wave.y) > wave.radius + obstacle.radius) continue;
        if (settleHit(obstacle, SHOCKWAVE.damage)) wave.hitTargets.add(obstacle);
      }
    }
    state.shockwaves = state.shockwaves.filter(wave => wave.age < SHOCKWAVE.duration);
    // Resolve attacks first: a kill in this step protects the ship from that target.
    for (const obstacle of state.obstacles) {
      if (obstacle.hp > 0 && obstacle.warning <= 0 && intersectsSweep(shipBefore, state.ship, obstacle.before, obstacle, obstacle.radius + state.ship.radius)) state.ended = true;
    }
    // A lethal impact stops collection. Expiration wins ties with pickup.
    if (!state.ended) {
      state.pickupFeedback = Math.max(0, state.pickupFeedback - dt);
      if (state.pickupFeedback === 0) state.pickupScore = 0;
      for (const resource of state.resources) {
        resource.life -= dt;
        if (resource.life <= 1e-10) continue;
        const dx = state.ship.x - resource.x, dy = state.ship.y - resource.y;
        const distance = Math.hypot(dx, dy);
        resource.vx = 0; resource.vy = 0;
        if (distance <= RESOURCE.attraction) {
          const travel = Math.min(distance, RESOURCE.speed * dt);
          if (distance) {
            resource.vx = dx / distance * RESOURCE.speed; resource.vy = dy / distance * RESOURCE.speed;
            moveSprite(resource, travel / RESOURCE.speed);
          }
          if (distance - travel <= resource.radius) {
            resource.life = 0;
            if (resource.kind === 'shockwave') state.shockwaveCharges = Math.min(3, state.shockwaveCharges + 1);
            else if (state.weaponLevel < 4) state.weaponLevel++;
            else { state.pickupScore += RESOURCE.maxWeaponPoints; state.score += RESOURCE.maxWeaponPoints; }
            state.pickupKind = resource.kind;
            state.pickupFeedback = RESOURCE.feedback;
          }
        }
      }
      state.resources = state.resources.filter(resource => resource.life > 1e-10);
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
      if (paused || state.ended) { shockwaveHeld = Boolean(input.shockwave); return; }
      if (input.shockwave && !shockwaveHeld) shockwavePending = true;
      shockwaveHeld = Boolean(input.shockwave);
      remainder += seconds;
      while (remainder + 1e-10 >= STEP && !state.ended) { step(STEP, input); remainder -= STEP; }
    },
    setPaused(value) { paused = value; if (value) shockwavePending = false; },
    resize(next) {
      bounds = next;
      state.ship.x = constrain(state.ship.x, bounds.left + shipInsets.left, bounds.right - shipInsets.right);
      state.ship.y = constrain(state.ship.y, bounds.top + shipInsets.top, bounds.bottom - shipInsets.bottom);
    },
  };
}
