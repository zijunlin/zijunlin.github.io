import { ordinarySpawnRandom } from '../helpers/ordinary-spawn-random.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
function game() {
  const sequence = [0, .6, .5, .5, 0];
  const battle = createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, random: ordinarySpawnRandom(() => sequence), reducedMotion: true });
  return battle;
}
test('successful spawns offer the six-item independent resource cycle and a fresh battle restarts the cycle', () => {
  for (const battle of [game(), game()]) {
    const seen = new Set(), kinds = [];
    while (kinds.length < 24 && battle.state.seconds < 30) {
      battle.advance(1 / 120);
      for (const target of battle.state.obstacles) if (!seen.has(target)) { seen.add(target); kinds.push(target.resource); }
    }
    assert.deepEqual(kinds, [null, null, null, 'trajectory', null, null, null, 'fireRate', null, null, null, 'shockwave', null, null, null, 'movement', null, null, null, 'piercing', null, null, null, 'shockwave']);
  }
});
test('collecting real shockwave drops refills to three without awarding pickup score', () => {
  const battle = game();
  const reserves = [];
  while (reserves.length < 3 && battle.state.seconds < 45 && !battle.state.ended) {
    battle.advance(1 / 120);
    const drop = battle.state.resources[0];
    if (!drop) continue;
    const score = battle.state.score;
    battle.resize({ left: 0, right: 800, top: -100, bottom: drop.y + 23.1 });
    battle.advance(1 / 120);
    if (drop.kind === 'shockwave') {
      reserves.push(battle.state.shockwaveCharges);
      assert.equal(battle.state.score, score);
      assert.equal(battle.state.pickupScore, 0);
    }
    assert.ok(!battle.state.resources.includes(drop));
    battle.resize({ left: 0, right: 800, top: 238.5, bottom: 300 });
    battle.resize({ left: 0, right: 800, top: 0, bottom: 300 });
  }
  assert.deepEqual(reserves, [2, 3, 3]);
});
test('bullets and a shockwave jointly destroy a five-hit resource obstacle with one score and drop', () => {
  const sequence = [.9, .6, .5, .5, 0];
  const battle = createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, random: ordinarySpawnRandom(() => sequence), reducedMotion: true });
  battle.advance(4.2);
  const target = battle.state.obstacles.find(o => o.resource);
  assert.equal(target.hp, 5);
  assert.equal(battle.state.score, 180);
  battle.resize({ left: 0, right: 800, top: 0, bottom: 165.1 });
  battle.advance(42 / 120, { x: 0, y: 0, shockwave: true });
  assert.equal(target.hp, 0);
  assert.equal(battle.state.score, 240);
  assert.equal(battle.state.resources.length, 1);
  battle.advance(.1);
  assert.equal(battle.state.score, 240);
  assert.equal(battle.state.resources.length, 1);
});
test('shockwave drops share the eight-second lifetime and pause freeze', () => {
  const battle = game();
  while (!battle.state.resources.some(r => r.kind === 'shockwave')) battle.advance(1 / 120);
  const drop = battle.state.resources.find(r => r.kind === 'shockwave');
  battle.setPaused(true); const frozen = JSON.stringify(battle.state);
  battle.advance(20); assert.equal(JSON.stringify(battle.state), frozen);
  battle.setPaused(false); battle.advance(drop.life - 1 / 120);
  assert.ok(battle.state.resources.includes(drop));
  battle.advance(1 / 120); assert.ok(!battle.state.resources.includes(drop));
  assert.equal(battle.state.shockwaveCharges, 1);
});
