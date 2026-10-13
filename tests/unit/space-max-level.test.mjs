import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
import { growthRun, harvest, collectDrop, growthBounds, step } from '../helpers/battle-growth.mjs';

test('real drops independently grow every trajectory count through 24, movement through 570 and each capped attribute awards only 50 points', () => {
  const { battle } = growthRun();
  const counts = [2], speeds = [390], rates = [.16], bonuses = new Set();
  harvest(battle, s => s.trajectoryCount === 24, (drop, before, state) => {
    if (state.trajectoryCount !== before.trajectoryCount) counts.push(state.trajectoryCount);
    if (state.ship.movementSpeed !== before.movementSpeed) speeds.push(state.ship.movementSpeed);
    if (state.fireInterval !== before.fireInterval) rates.push(state.fireInterval);
    const result = state.pickupResults.at(-1);
    if (result.full && drop.kind !== 'shockwave') { assert.equal(state.score - before.score, 50); bonuses.add(drop.kind); }
    if (drop.kind !== 'trajectory') assert.equal(state.trajectoryCount, before.trajectoryCount);
    if (drop.kind !== 'fireRate') assert.equal(state.fireInterval, before.fireInterval);
    if (drop.kind !== 'movement') assert.equal(state.ship.movementSpeed, before.movementSpeed);
    if (drop.kind !== 'piercing') assert.equal(state.piercing, before.piercing);
    before.bullets.forEach(([bullet, piercing]) => assert.equal(bullet.piercing, piercing, 'already emitted shots retain their launch attributes'));
  });
  assert.deepEqual(counts, [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]);
  assert.deepEqual(speeds, [390,450,510,570]);
  assert.deepEqual(rates, [.16,.13,.11]);
  assert.equal(battle.state.piercing, true);
  assert.deepEqual([...bonuses].sort(), ['fireRate','movement','piercing']);
  let overflow;
  harvest(battle, () => Boolean(overflow), (drop, before, state) => {
    if (drop.kind === 'trajectory') { overflow = true; assert.equal(state.score - before.score, 50); assert.equal(state.trajectoryCount, 24); }
    if (drop.kind === 'shockwave') assert.equal(state.score, before.score, 'full wave reserve never converts to points');
  });
  battle.setPaused(true); const frozen = JSON.stringify(battle.state);
  battle.advance(20); assert.equal(JSON.stringify(battle.state), frozen);
  const fresh = createBattle({ bounds: growthBounds });
  assert.equal(fresh.state.trajectoryCount, 2); assert.equal(fresh.state.fireInterval, .16);
  assert.equal(fresh.state.piercing, false); assert.equal(fresh.state.ship.movementSpeed, 390);
  assert.equal(fresh.state.shockwaveCharges, 1); assert.deepEqual(fresh.state.pickupResults, []);
});

test('every unlocked trajectory emits one evenly spaced ray, with 12 and 120 degree endpoints; satellites and old bullets keep their own attributes', () => {
  const { battle } = growthRun();
  const observed = new Set();
  harvest(battle, s => s.trajectoryCount === 24, (drop, before, state) => {
    if (drop.kind !== 'trajectory') return;
    battle.resize({ left: -2000, right: 2000, top: -2000, bottom: 2000 });
    const old = state.bullets.map(b => [b, b.piercing]);
    let born;
    for (let tick = 0; tick < 22; tick++) {
      battle.advance(step);
      born = state.bullets.filter(b => b.life > 1.89 && (state.piercing ? b.piercing : b.vy < -250 && Math.abs(b.vx) > .01));
      if (born.length) break;
    }
    // At three rays the ordinary central ray overlaps the upward satellite direction;
    // inspect its siblings plus all newborn upward ordinary rays at the ship's muzzle.
    if (!state.piercing) born = state.bullets.filter(b => b.life > 1.89 && b.vy < -250 && Math.abs(b.y - (state.ship.y - 12 + b.vy * step)) < .001);
    assert.equal(born.length, state.trajectoryCount);
    const angles = born.map(b => Math.atan2(b.vx, -b.vy));
    assert.ok(Math.abs(angles[0] + angles.at(-1)) < 1e-10);
    for (let i = 2; i < angles.length; i++) assert.ok(Math.abs(angles[i] - angles[i-1] - angles[1] + angles[0]) < 1e-10);
    if (born.length === 3) assert.ok(Math.abs(angles.at(-1) - Math.PI / 30) < 1e-10);
    if (born.length === 10) assert.ok(Math.abs(angles.at(-1) - 24 * Math.PI / 180) < 1e-10);
    if (born.length === 17) assert.ok(Math.abs(angles.at(-1) - 42 * Math.PI / 180) < 1e-10);
    if (born.length === 24) assert.ok(Math.abs(angles.at(-1) - Math.PI / 3) < 1e-10);
    born.forEach(b => assert.ok(Math.abs(Math.hypot(b.vx,b.vy) - 520) < 1e-8));
    old.forEach(([b,piercing]) => assert.equal(b.piercing, piercing));
    observed.add(born.length);
    battle.resize(growthBounds);
  });
  assert.equal(observed.size, 22);
  battle.resize({ left: -2000, right: 2000, top: -2000, bottom: 2000 });
  battle.advance(.2);
  const forwardTimes = [], satelliteTimes = [];
  for (let tick=0;tick<132;tick++) {
    battle.advance(step);
    const born = battle.state.bullets.filter(b => b.life > 1.89);
    const forward = born.filter(b => b.piercing), satellites = born.filter(b => !b.piercing);
    if (forward.length) { assert.equal(forward.length,24); forwardTimes.push(battle.state.seconds); }
    if (satellites.length) { assert.equal(satellites.length,4); satelliteTimes.push(battle.state.seconds); }
  }
  assert.equal(forwardTimes.length,10);
  for(let i=1;i<forwardTimes.length;i++) assert.ok(Math.abs(forwardTimes[i]-forwardTimes[i-1]-.11)<step+1e-10);
  for(let i=1;i<satelliteTimes.length;i++) assert.ok(Math.abs(satelliteTimes[i]-satelliteTimes[i-1]-.16)<step+1e-10);
});

for (const speed of [450, 510, 570]) test(`real movement pickups move diagonally at ${speed} CSS px/s and still constrain the ship`, () => {
  const { battle } = growthRun();
  harvest(battle, s => s.ship.movementSpeed === speed);
  battle.resize({ left: -2000, right: 2000, top: -2000, bottom: 2000 });
  const { x, y } = battle.state.ship;
  battle.advance(.1, { x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(battle.state.ship.x - x, battle.state.ship.y - y) - speed / 10) < 1e-8);
  battle.resize(growthBounds);
  battle.advance(1, { x: 1, y: 1 });
  assert.ok(battle.state.ship.x <= 786.8); assert.ok(battle.state.ship.y <= 276.9);
});

test('nearby full-ability drops collected together preserve each result and combined score feedback', () => {
  const { battle } = growthRun();
  harvest(battle, s => s.trajectoryCount === 24);
  while (battle.state.resources.length < 2 && battle.state.seconds < 240) battle.advance(step);
  assert.equal(battle.state.resources.length, 2);
  const drops = [...battle.state.resources], score = battle.state.score;
  collectDrop(battle, drops[0]);
  assert.equal(battle.state.pickupResults.length, 2);
  const expectedBonus = drops.filter(drop => drop.kind !== 'shockwave').length * 50;
  assert.equal(battle.state.score - score, expectedBonus);
  assert.equal(battle.state.pickupScore, expectedBonus);
  assert.ok(drops.every(drop => !battle.state.resources.includes(drop)));
});
