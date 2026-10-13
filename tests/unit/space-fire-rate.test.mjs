import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';

function collectTwo() {
  
  const battle = createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, random: () => .5, reducedMotion: true });
  for (let pickup = 0; pickup < 2; pickup++) {
    while (!battle.state.resources.length && battle.state.seconds < 15) battle.advance(1 / 120);
    while (battle.state.resources.length && battle.state.seconds < 15) battle.advance(1 / 120, { x: 0, y: -1 });
    if (pickup === 0) {
      // Keep the original return position (y=262) with the smaller ship-only inset.
      battle.resize({ left: 0, right: 800, top: 0, bottom: 285.1 });
      battle.advance(.8, { x: 0, y: 1 });
      battle.resize({ left: 0, right: 800, top: 0, bottom: 300 });
    }
  }
  return battle;
}

test('two collected drops accelerate the three-shot fan while satellites keep .16-second cadence', () => {
  const battle = collectTwo();
  assert.equal(battle.state.trajectoryCount, 3);
  assert.equal(battle.state.fireInterval, .13);
  assert.equal(battle.state.ship.movementSpeed, 390);
  assert.equal(battle.state.piercing, false);
  assert.equal(battle.state.ended, false);
  assert.equal(battle.state.resources.length, 0);
  battle.resize({ left: -2000, right: 2000, top: -2000, bottom: 2000 });
  // Discard the remaining wait from the pre-upgrade volley, then count real births.
  battle.advance(.2);
  let forward = 0, satellites = 0;
  const forwardTimes = [], satelliteTimes = [];
  for (let i = 0; i < 156; i++) {
    battle.advance(1 / 120);
    const born = battle.state.bullets.filter(b => b.life > 1.89);
    const fanSides = born.filter(b => b.vy < -500 && Math.abs(b.vx) > 20);
    const otherSatellites = born.filter(b => b.vy >= -500);
    if (fanSides.length) { forward += fanSides.length / 2 * 3; forwardTimes.push(battle.state.seconds); }
    if (otherSatellites.length) { satellites += otherSatellites.length / 3 * 4; satelliteTimes.push(battle.state.seconds); }
  }
  assert.equal(forward, 30);
  // A 1.3-second observation spans eight or nine .16-second volleys,
  // depending on the independently preserved satellite phase.
  assert.ok(satellites === 32 || satellites === 36);
  for (let i = 1; i < forwardTimes.length; i++) assert.ok(Math.abs(forwardTimes[i] - forwardTimes[i - 1] - .13) < 1 / 120);
  for (let i = 1; i < satelliteTimes.length; i++) assert.ok(Math.abs(satelliteTimes[i] - satelliteTimes[i - 1] - .16) < 1 / 120);
  battle.setPaused(true); const frozen = JSON.stringify(battle.state);
  battle.advance(20); assert.equal(JSON.stringify(battle.state), frozen);
});

test('upgrading retains the in-flight wait before adopting faster fire, without a burst', () => {
  const battle = collectTwo();
  const latestForward = Math.max(...battle.state.bullets.filter(b => b.vy < -500 && Math.abs(b.vx) > 20).map(b => b.life));
  const sinceVolley = 1.9 - latestForward;
  let waited = 0, newShots = [];
  while (!newShots.length && waited < .2) {
    battle.advance(1 / 120); waited += 1 / 120;
    newShots = battle.state.bullets.filter(b => b.life > 1.89 && b.vy < -500 && Math.abs(b.vx) > 20);
  }
  assert.equal(newShots.length, 2);
  assert.ok(Math.abs(sinceVolley + waited - .16) <= 1 / 120 + 1e-10);
});
