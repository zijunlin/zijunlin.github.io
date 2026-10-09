import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
const bounds = { left: 0, right: 800, top: 0, bottom: 300 };
function grow() {
  let i = 0;
  const battle = createBattle({ bounds, reducedMotion: true, random: () => [0,.6,.5,.5,0][i++ % 5] });
  while (battle.state.weaponLevel < 3 && battle.state.seconds < 20 && !battle.state.ended) {
    battle.advance(1 / 120);
    if (battle.state.resources.length) {
      battle.resize({ ...bounds, top: -100, bottom: battle.state.resources[0].y + 38 });
      battle.advance(1 / 120);
      battle.resize({ ...bounds, top: 217, bottom: 500 });
      battle.resize(bounds);
    }
  }
  return battle;
}
test('third weapon pickup unlocks three piercing shots at .13 seconds and leaves satellites ordinary', () => {
  const battle = grow();
  assert.equal(battle.state.weaponLevel, 3);
  assert.equal(battle.state.ended, false);
  battle.resize({ left: -2000, right: 2000, top: -2000, bottom: 2000 });
  battle.advance(.2);
  let forward = 0, satellites = 0;
  const forwardTimes = [], satelliteTimes = [];
  for (let i = 0; i < 156; i++) {
    battle.advance(1 / 120);
    const born = battle.state.bullets.filter(b => b.life > 1.89);
    const forwardShots = born.filter(b => b.piercing), satelliteShots = born.filter(b => !b.piercing);
    if (forwardShots.length) { assert.equal(forwardShots.length, 3); forwardTimes.push(battle.state.seconds); }
    if (satelliteShots.length) { assert.equal(satelliteShots.length, 4); satelliteTimes.push(battle.state.seconds); }
    forward += forwardShots.length;
    satellites += satelliteShots.length;
  }
  assert.equal(forward, 30);
  assert.ok(satellites === 32 || satellites === 36);
  for (let i = 1; i < forwardTimes.length; i++) assert.ok(Math.abs(forwardTimes[i] - forwardTimes[i - 1] - .13) < 1 / 120);
  for (let i = 1; i < satelliteTimes.length; i++) assert.ok(Math.abs(satelliteTimes[i] - satelliteTimes[i - 1] - .16) < 1 / 120);
  battle.setPaused(true);
  const frozen = JSON.stringify(battle.state);
  battle.advance(20);
  assert.equal(JSON.stringify(battle.state), frozen);
});

function arrangeTargets(rows, level = 3) {
  const dt = 1 / 120;
  let draws = 0, sequence = [0, .6, .5, .5, 0];
  const battle = createBattle({ bounds, random: () => sequence[draws++ % 5], reducedMotion: true });
  const wide = { left: -3000, right: 3000, top: -3000, bottom: 3000 };
  function place(x, y) {
    battle.resize({ left: x - 38, right: x + 38, top: y - 38, bottom: y + 38 });
    battle.resize(wide);
  }
  // Collect real drops; resize clamps the ship to their pickup radius.
  while (battle.state.weaponLevel < level && battle.state.seconds < 25) {
    if (battle.state.resources.length) {
      battle.resize({ ...bounds, top: -100, bottom: battle.state.resources[0].y + 38 });
      battle.advance(dt);
      battle.resize({ ...bounds, top: 217, bottom: 500 });
      battle.resize(bounds);
    } else battle.advance(dt);
  }
  assert.equal(battle.state.weaponLevel, level);
  const targets = [];
  // Park beyond the projectiles' lifetime, then generate three targets travelling
  // horizontally together. Their spawn order is opposite the upward contact order.
  place(2000, 0);
  if (level === 4) battle.advance(2);
  while (targets.length < rows.length && battle.state.seconds < 30) {
    const y = rows[targets.length];
    const x = targets.length ? targets[0].x + targets[0].vx * .65 : 0;
    battle.resize({ left: x + 21, right: 2100, top: -100, bottom: 100 });
    sequence = [.4, 0, (y + 100) / 200, .5 - Math.atan2(-y, 2000 - x) / .9, 0];
    const previous = new Set(battle.state.obstacles);
    battle.advance(dt);
    for (const target of battle.state.obstacles) if (!previous.has(target)) targets.push(target);
  }
  assert.equal(targets.length, rows.length);
  sequence = [.4, 0, .5, .5, 0];
  battle.resize(wide);
  while (targets.some(target => target.warning > 0)) battle.advance(dt);
  // Aim the +6° ray at their future position, away from the central satellite ray.
  const height = 650, flight = (height - 12 - 23) / (520 * Math.cos(Math.PI / 30));
  const launchX = targets[0].x + (targets[0].vx - 520 * Math.sin(Math.PI / 30)) * flight;
  place(launchX, height);

  return { battle, targets, dt };
}

test('one piercing bolt hits the first two moving targets along its sweep, regardless of spawn order', () => {
  const { battle, targets, dt } = arrangeTargets([-1, 0, 1]);
  const initialScore = battle.state.score;

  for (let i = 0; i < 220 && targets.every(t => t.hp === 3); i++) battle.advance(dt);
  assert.deepEqual(targets.map(t => t.hp), [3, 2, 2]);
  // The exhausted bolt must not remain inside the untouched third target.
  battle.advance(dt * 3);
  assert.deepEqual(targets.map(t => t.hp), [3, 2, 2]);
  for (let i = 0; i < 100 && targets.slice(1).some(t => t.hp > 0); i++) battle.advance(dt);
  assert.deepEqual(targets.slice(1).map(t => t.hp), [0, 0]);
  assert.equal(battle.state.score - initialScore, 60);
  battle.advance(dt * 5);
  assert.equal(battle.state.score - initialScore, 60);
});


test('a piercing bolt crosses one target over many steps, then disappears on its second distinct target', () => {
  const { battle, targets, dt } = arrangeTargets([-1, -56]);
  let shot;
  for (let i = 0; i < 220 && targets[0].hp === 3; i++) {
    shot = battle.state.bullets.find(b => b.piercing && b.vx > 20 && Math.abs(b.y - targets[0].y) < 40);
    battle.advance(dt);
  }
  assert.deepEqual(targets.map(t => t.hp), [2, 3]);
  assert.ok(shot && battle.state.bullets.includes(shot));
  for (let i = 0; i < 6; i++) {
    battle.advance(dt);
    assert.equal(targets[0].hp, 2);
    assert.ok(battle.state.bullets.includes(shot));
  }
  for (let i = 0; i < 20 && targets[1].hp === 3; i++) battle.advance(dt);
  assert.deepEqual(targets.map(t => t.hp), [2, 2]);
  assert.ok(!battle.state.bullets.includes(shot));
});

test('level four piercing shots each damage two different targets once', () => {
  const { battle, targets, dt } = arrangeTargets([-1, 0, 1], 4);
  for (let i = 0; i < 220 && targets.every(t => t.hp === 3); i++) battle.advance(dt);
  assert.deepEqual(targets.map(t => t.hp), [3, 2, 2]);
  battle.advance(dt * 3);
  assert.deepEqual(targets.map(t => t.hp), [3, 2, 2]);
});
