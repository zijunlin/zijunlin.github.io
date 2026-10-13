import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
import { obstacleTypes } from '../../src/features/work-games/obstacle-types.js';
import { createProjectile, advanceProjectile, projectileProfiles } from '../../src/features/work-games/projectiles.js';
import { hitObstacle } from '../../src/features/work-games/rules.js';
import { createSprite } from '../../src/features/work-games/sprites.js';
import { advanceMotion } from '../../src/features/work-games/motion.js';
import { pickups, applyPickup, dropCycle } from '../../src/features/work-games/abilities.js';
import { pickupPresentation, describePickup, drawPickupMarker } from '../../src/features/work-games/pickup-presentation.js';

const target = x => ({ x, y: 0, before: { x, y: 0 }, radius: 1, hp: 3, points: 10, warning: 0 });
const settle = (obstacle, damage) => { if (obstacle.hp <= 0) return false; hitObstacle(obstacle, damage); return true; };

test('adding an obstacle definition makes it selectable through the real battle entry', () => {
  const extra = { radius: 40, hp: 7, points: 100, sizeSpeedMultiplier: .6 };
  obstacleTypes.push(extra);
  try {
    const battle = createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, random: purpose => purpose === 'type' ? .999 : .5 });
    battle.advance(1.01);
    assert.equal(battle.state.obstacles.length, 1);
    assert.equal(battle.state.obstacles[0].radius, 40);
    assert.equal(battle.state.obstacles[0].hp, 7);
  } finally { obstacleTypes.pop(); }
});

test('a custom projectile profile controls damage and distinct hit count independent of its visual flag', () => {
  const profile = { ...projectileProfiles.ordinary, speed: 100, damage: 2, maxHits: 3, life: 2, radius: 4 };
  const bullet = createProjectile({ x: 0, y: 0, angle: 0, profile });
  // The already-created projectile owns its values even when a definition changes.
  profile.damage = 9; profile.maxHits = 1; profile.radius = 1;
  const targets = [25, 50, 75, 95].map(target);
  advanceProjectile(bullet, 1, [...targets].reverse(), settle);
  assert.deepEqual(targets.map(t => t.hp), [1, 1, 1, 3]);
  assert.equal(bullet.hitTargets.size, 3);
  assert.equal(bullet.life, 0);
  assert.equal(bullet.radius, 4);
  assert.equal(bullet.piercing, false);
});

test('a slower projectile cannot damage the same overlapping target on successive steps', () => {
  const bullet = createProjectile({ x: 0, y: 0, angle: 0, profile: { ...projectileProfiles.piercing, speed: 10 } });
  const obstacle = target(2);
  advanceProjectile(bullet, .1, [obstacle], settle);
  advanceProjectile(bullet, .1, [obstacle], settle);
  assert.equal(obstacle.hp, 2);
  assert.equal(bullet.hitTargets.size, 1);
  assert.ok(bullet.life > 0);
});

test('projectile contact stops at its lifetime and respects moving targets and warning', () => {
  const profile = { ...projectileProfiles.ordinary, speed: 100, life: .05 };
  const bullet = createProjectile({ x: 0, y: 0, angle: 0, profile });
  const late = target(10), warning = { ...target(2), warning: .5 };
  advanceProjectile(bullet, 1, [late, warning], settle);
  assert.equal(bullet.x, 5);
  assert.deepEqual([late.hp, warning.hp], [3, 3]);
  const moving = { ...target(-10), before: { x: 10, y: 0 } };
  const stationary = createProjectile({ x: 0, y: 0, angle: 0, profile: { ...projectileProfiles.ordinary, speed: 0 } });
  advanceProjectile(stationary, 1, [moving], settle);
  assert.equal(moving.hp, 2);
});

test('serializable motion descriptors support both free flight and attraction without overshoot', () => {
  const sprite = createSprite({ x: 0, y: 0, radius: 2, vx: 3, vy: 4 });
  advanceMotion(sprite, 2);
  assert.deepEqual([sprite.x, sprite.y], [6, 8]);
  sprite.motion = { kind: 'attraction', range: 10, speed: 20 };
  const restored = structuredClone(sprite);
  advanceMotion(restored, 1, { target: { x: 9, y: 12 } });
  assert.deepEqual([restored.x, restored.y], [9, 12]);
  assert.deepEqual([restored.vx, restored.vy], [12, 16]);
  advanceMotion(restored, 1, { target: { x: 90, y: 120 } });
  assert.deepEqual([restored.x, restored.y, restored.vx, restored.vy], [9, 12, 0, 0]);
  advanceMotion(restored, 1, { target: { x: 9, y: 12 } });
  assert.ok(Number.isFinite(restored.x));
});

test('every pickup has a marker and bilingual outcomes, including full-cap rewards', () => {
  assert.deepEqual(Object.keys(pickupPresentation).sort(), Object.keys(pickups).sort());
  assert.ok(dropCycle.every(kind => pickupPresentation[kind]));
  const baseline = () => ({ trajectoryCount: 2, fireInterval: .16, piercing: false, ship: { movementSpeed: 390 }, shockwaveCharges: 1 });
  for (const kind of Object.keys(pickups)) {
    const state = baseline();
    for (let count = 0; count < 25; count++) {
      for (const result of applyPickup(kind, state)) {
        const zh = describePickup(result, zh => zh), en = describePickup(result, (_, en) => en);
        assert.ok(zh.length > 0 && en.length > 0);
        assert.notEqual(zh, en);
      }
    }
    assert.equal(typeof pickupPresentation[kind].draw, 'function');
  }
  assert.equal(describePickup({ kind: 'movement', full: true, points: 75 }, (_, en) => en), 'At maximum, +75 points');
  assert.equal(describePickup({ kind: 'shockwave', full: true, points: 0 }, zh => zh), '冲击波储备已满');
  assert.throws(() => drawPickupMarker({}, 'missing', 0, 0, 1), /Missing pickup presentation/);
});

test('combined effects reuse existing result feedback and report the configured piercing count', () => {
  pickups.combined = { abilities: [...pickups.trajectory.abilities, ...pickups.movement.abilities] };
  const maxHits = projectileProfiles.piercing.maxHits;
  try {
    const state = { trajectoryCount: 2, ship: { movementSpeed: 390 } };
    const results = applyPickup('combined', state);
    assert.equal(state.trajectoryCount, 3);
    assert.equal(state.ship.movementSpeed, 450);
    assert.deepEqual(results.map(result => describePickup(result, (_, en) => en)), ['Ship trajectories +1 · Now 3', 'Ship movement speed increased']);
    projectileProfiles.piercing.maxHits = 3;
    assert.equal(describePickup({ kind: 'piercing', full: false }, (_, en) => en), 'Piercing increased · Hits 3 targets');
  } finally { delete pickups.combined; projectileProfiles.piercing.maxHits = maxHits; }
});
