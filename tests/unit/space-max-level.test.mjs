import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
const bounds = { left: 0, right: 800, top: 0, bottom: 300 };
function grow() {
  let i = 0;
  const battle = createBattle({ bounds, reducedMotion: true, random: () => [0,.6,.5,.5,0][i++ % 5] });
  const levels = [0];
  while (battle.state.weaponLevel < 4 && battle.state.seconds < 20 && !battle.state.ended) {
    battle.advance(1 / 120);
    if (battle.state.resources.length) {
      battle.resize({ ...bounds, top: -100, bottom: battle.state.resources[0].y + 38 });
      battle.advance(1 / 120);
      if (levels.at(-1) !== battle.state.weaponLevel) levels.push(battle.state.weaponLevel);
      battle.resize({ ...bounds, top: 217, bottom: 500 });
      battle.resize(bounds);
    }
  }
  assert.deepEqual(levels, [0, 1, 2, 3, 4]);
  return battle;
}
test('fourth weapon pickup unlocks four piercing shots at .11 seconds and leaves satellites ordinary', () => {
  const battle = grow();
  assert.equal(battle.state.weaponLevel, 4);
  assert.equal(battle.state.ended, false);
  battle.resize({ left: -2000, right: 2000, top: -2000, bottom: 2000 });
  battle.advance(.2);
  let forward = 0, satellites = 0;
  const forwardTimes = [], satelliteTimes = [];
  for (let i = 0; i < 132; i++) {
    battle.advance(1 / 120);
    const born = battle.state.bullets.filter(b => b.life > 1.89);
    const forwardShots = born.filter(b => b.piercing), satelliteShots = born.filter(b => !b.piercing);
    if (forwardShots.length) { assert.equal(forwardShots.length, 4); assert.equal(new Set(forwardShots.map(b => b.vx)).size, 4); forwardTimes.push(battle.state.seconds); }
    if (satelliteShots.length) { assert.equal(satelliteShots.length, 4); satelliteTimes.push(battle.state.seconds); }
    forward += forwardShots.length;
    satellites += satelliteShots.length;
  }
  assert.equal(forward, 40);
  assert.ok(satellites === 24 || satellites === 28);
  for (let i = 1; i < forwardTimes.length; i++) assert.ok(Math.abs(forwardTimes[i] - forwardTimes[i - 1] - .11) < 1 / 120);
  for (let i = 1; i < satelliteTimes.length; i++) assert.ok(Math.abs(satelliteTimes[i] - satelliteTimes[i - 1] - .16) < 1 / 120);
  battle.setPaused(true);
  const frozen = JSON.stringify(battle.state);
  battle.advance(20);
  assert.equal(JSON.stringify(battle.state), frozen);
});


test('a real weapon drop at maximum level awards 50 points once and freezes with the battle', () => {
  const battle = grow();
  while (!battle.state.resources.some(r => r.kind === 'weapon') && battle.state.seconds < 25) battle.advance(1 / 120);
  const drop = battle.state.resources.find(r => r.kind === 'weapon');
  assert.ok(drop);
  const score = battle.state.score;
  battle.resize({ ...bounds, top: -100, bottom: drop.y + 38 });
  battle.advance(1 / 120);
  assert.equal(battle.state.weaponLevel, 4);
  assert.equal(battle.state.score, score + 50);
  assert.equal(battle.state.pickupScore, 50);
  assert.ok(!battle.state.resources.includes(drop));
  battle.setPaused(true); const frozen = JSON.stringify(battle.state);
  battle.advance(20); assert.equal(JSON.stringify(battle.state), frozen);
  battle.setPaused(false); battle.advance(1 / 120);
  assert.equal(battle.state.score, score + 50);
  const replay = createBattle({ bounds });
  assert.equal(replay.state.weaponLevel, 0);
  assert.equal(replay.state.pickupScore, 0);
});

test('simultaneous max-level drops show their combined score even alongside a shockwave refill', () => {
  const battle = grow();
  while (battle.state.resources.filter(resource => resource.kind === 'weapon').length < 2 && battle.state.seconds < 40) battle.advance(1 / 120);
  assert.equal(battle.state.resources.filter(resource => resource.kind === 'weapon').length, 2);
  assert.ok(battle.state.resources.some(resource => resource.kind === 'shockwave'));
  const score = battle.state.score, charges = battle.state.shockwaveCharges;
  battle.resize({ ...bounds, top: -100, bottom: battle.state.resources[0].y + 23.1 });
  battle.advance(1 / 120);
  assert.equal(battle.state.score - score, 100);
  assert.equal(battle.state.shockwaveCharges, Math.min(3, charges + 1));
  assert.equal(battle.state.weaponLevel, 4);
  assert.equal(battle.state.pickupScore, 100);
  assert.ok(battle.state.pickupFeedback > 0);
});
