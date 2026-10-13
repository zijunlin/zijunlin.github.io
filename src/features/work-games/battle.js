import { applyPickup, dropCycle } from './abilities.js';
import { createSprite } from './sprites.js';
import { advanceMotion } from './motion.js';
import { obstacleTypes } from './obstacle-types.js';
import { createProjectile, projectileProfiles, advanceProjectile } from './projectiles.js';
import { difficultyAt, hitObstacle, intersectsSweep } from './rules.js';
// Pickup distances use CSS pixels; feedback lifetime uses battle seconds.
const RESOURCE = { lifetime: 8, attraction: 110, speed: 720, pickup: 16, feedback: 1.2, edgeInset: 12 };
// Visible ship viewport, excluding the orbiting satellites.
const shipInsets = { left: 13.2, right: 13.2, top: 16.5, bottom: 23.1 };
const STEP = 1 / 120;
const SHOCKWAVE = { radius: 220, duration: .5, damage: 3 };
const constrain = (n, low, high) => Math.max(low, Math.min(high, n));

// Random purposes let deterministic scenarios survive spawn retries; zero-argument sources remain valid.
// A deterministic simulation: only advancing an unpaused battle consumes time.
export function createBattle({ bounds, random = Math.random, reducedMotion = false }) {
  const state = { seconds: 0, score: 0, ended: false, ship: { ...createSprite({ x: (bounds.left + bounds.right) / 2, y: bounds.bottom - 45, radius: 4 }), movementSpeed: 390 }, bullets: [], obstacles: [], particles: [], resources: [], trajectoryCount: 2, fireInterval: .16, piercing: false, pickupFeedback: 0, pickupScore: 0, pickupResults: [], shockwaveCharges: 1, shockwaves: [] };
  let paused = false, remainder = 0, shotWait = 0, satelliteWait = 0, spawnWait = 1, generated = 0, shockwaveHeld = false, shockwavePending = false;
  function spawn() {
    if (state.obstacles.length >= 45) return;
    const type = obstacleTypes[Math.floor(random('type') * obstacleTypes.length)];
    let x, y, valid = false;
    for (let attempt = 0; attempt < 16; attempt++) {
      const side = Math.floor(random('side') * 4), along = random('position');
      x = side === 0 ? bounds.left - type.radius : side === 1 ? bounds.right + type.radius : bounds.left + (bounds.right - bounds.left) * along;
      y = side === 2 ? bounds.top - type.radius : side === 3 ? bounds.bottom + type.radius : bounds.top + (bounds.bottom - bounds.top) * along;
      if (Math.hypot(x - state.ship.x, y - state.ship.y) >= 210) { valid = true; break; }
    }
    if (!valid) return;
    const heading = Math.atan2(state.ship.y - y, state.ship.x - x) + (random('heading') - .5) * .9;
    const baseVelocity = (32 + random('speed') * 20 + difficultyAt(state.seconds).level * 9) * type.sizeSpeedMultiplier;
    const fast = state.seconds >= 9 && random('fast') < .15;
    const velocity = baseVelocity * (fast ? 2 : 1);
    generated++;
    state.obstacles.push({ ...type, fast, ...createSprite({ x, y, radius: type.radius, vx: Math.cos(heading) * velocity, vy: Math.sin(heading) * velocity }), resource: generated % 4 === 0 ? dropCycle[(generated / 4 - 1) % dropCycle.length] : null, warning: .65, flash: 0 });
  }
  function shot(x, y, angle, piercing = false) {
    state.bullets.push(createProjectile({ x, y, angle, profile: piercing ? projectileProfiles.piercing : projectileProfiles.ordinary }));
  }
  function fireForward() {
    const { x, y } = state.ship;
    if (state.trajectoryCount === 2) {
      shot(x - 5, y - 12, -Math.PI / 2, state.piercing); shot(x + 5, y - 12, -Math.PI / 2, state.piercing);
    } else {
      const halfAngle = (12 + (state.trajectoryCount - 3) * 108 / 21) * Math.PI / 360;
      for (let i = 0; i < state.trajectoryCount; i++) shot(x, y - 12, -Math.PI / 2 - halfAngle + i * halfAngle * 2 / (state.trajectoryCount - 1), state.piercing);
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
      if (obstacle.resource) state.resources.push({ ...createSprite({ x: constrain(obstacle.x, bounds.left + RESOURCE.edgeInset, bounds.right - RESOURCE.edgeInset), y: constrain(obstacle.y, bounds.top + RESOURCE.edgeInset, bounds.bottom - RESOURCE.edgeInset), radius: RESOURCE.pickup, motion: { kind: 'attraction', range: RESOURCE.attraction, speed: RESOURCE.speed } }), kind: obstacle.resource, life: RESOURCE.lifetime });
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
    if (input.target) {
      const dx = input.target.x - state.ship.x, dy = input.target.y - state.ship.y;
      const factor = Math.min(1 / dt, state.ship.movementSpeed / (Math.hypot(dx, dy) || 1));
      state.ship.vx = dx * factor; state.ship.vy = dy * factor;
    }
    advanceMotion(state.ship, dt);
    state.ship.x = constrain(state.ship.x, bounds.left + shipInsets.left, bounds.right - shipInsets.right);
    state.ship.y = constrain(state.ship.y, bounds.top + shipInsets.top, bounds.bottom - shipInsets.bottom);
    state.ship.vx = (state.ship.x - shipBefore.x) / dt;
    state.ship.vy = (state.ship.y - shipBefore.y) / dt;
    shotWait -= dt;
    // Upgrades preserve the pending wait; the next volley starts the new cadence.
    if (shotWait <= 0) { fireForward(); shotWait += state.fireInterval; }
    satelliteWait -= dt;
    if (satelliteWait <= 0) { fireSatellites(); satelliteWait += .16; }
    spawnWait -= dt;
    if (spawnWait <= 0) { spawn(); spawnWait += difficultyAt(state.seconds).interval; }
    for (const obstacle of state.obstacles) {
      obstacle.before = { x: obstacle.x, y: obstacle.y };
      obstacle.flash = Math.max(0, obstacle.flash - dt);
      if (obstacle.warning > 0) { obstacle.warning = Math.max(0, obstacle.warning - dt); continue; }
      advanceMotion(obstacle, dt);
    }
    for (const bullet of state.bullets) advanceProjectile(bullet, dt, state.obstacles, settleHit);
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
      if (state.pickupFeedback === 0) { state.pickupScore = 0; state.pickupResults = []; }
      let collected = false;
      for (const resource of state.resources) {
        resource.life -= dt;
        if (resource.life <= 1e-10) continue;
        advanceMotion(resource, dt, { target: state.ship });
        if (Math.hypot(state.ship.x - resource.x, state.ship.y - resource.y) <= resource.radius) {
          resource.life = 0;
          if (!collected) { state.pickupScore = 0; state.pickupResults = []; collected = true; }
          const results = applyPickup(resource.kind, state);
          for (const result of results) { state.pickupScore += result.points; state.score += result.points; }
          state.pickupResults.push(...results);
          state.pickupFeedback = RESOURCE.feedback;
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
