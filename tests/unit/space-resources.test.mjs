import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
const bounds = { left: 0, right: 800, top: 0, bottom: 300 };
function game(stopTopSpawns = false) {
  const sequence = [0, .6, .5, .5, 0]; let index = 0;
  return createBattle({ bounds, random: () => stopTopSpawns && index >= 20 ? .4 : sequence[index++ % sequence.length], reducedMotion: true });
}
test('every fourth generated obstacle drops one weapon resource only on destruction', () => {
  const battle = game();
  battle.advance(3.8);
  assert.equal(battle.state.score, 30);
  assert.equal(battle.state.resources.length, 0);
  assert.equal(battle.state.weaponLevel, 0);
  battle.advance(.3);
  assert.equal(battle.state.obstacles[0].resource, 'weapon');
  assert.equal(battle.state.obstacles[0].hp, 1);
  assert.equal(battle.state.resources.length, 0);
  battle.advance(.6);
  assert.equal(battle.state.resources.length, 1);
  assert.equal(battle.state.weaponLevel, 0);
  battle.advance(.1);
  assert.equal(battle.state.resources.length, 1);
});

test('approaching a safe drop upgrades to a three-shot fan with unchanged satellite cadence', () => {
  const battle = game(); battle.advance(4.8);
  while (battle.state.weaponLevel === 0 && battle.state.seconds < 6) battle.advance(1 / 120, { x: 0, y: -1 });
  assert.equal(battle.state.weaponLevel, 1);
  assert.equal(battle.state.ended, false);
  assert.equal(battle.state.resources.length, 0);
  assert.ok(battle.state.pickupFeedback > 0);
  battle.resize({ left: -2000, right: 2000, top: -2000, bottom: 2000 });
  battle.advance(.17);
  const fresh = battle.state.bullets.filter(b => b.life > 1.74);
  assert.equal(fresh.length, 7);
  assert.equal(fresh.filter(b => b.vy < -500).length, 4); // three forward + upward satellite
  assert.ok(fresh.some(b => b.vx < -20 && b.vy < -500));
  assert.ok(fresh.some(b => b.vx > 20 && b.vy < -500));
});

test('uncollected resources expire after eight battle seconds and pause freezes them', () => {
  const battle = game(); battle.advance(4.8);
  const drop = battle.state.resources[0];
  battle.setPaused(true); const frozen = JSON.stringify(battle.state);
  battle.advance(20, { x: 0, y: -1 }); assert.equal(JSON.stringify(battle.state), frozen);
  battle.setPaused(false);
  battle.advance(drop.life - 1 / 120);
  assert.ok(battle.state.resources.includes(drop));
  battle.advance(1 / 120);
  assert.ok(!battle.state.resources.includes(drop));
  assert.equal(battle.state.weaponLevel, 0);
  const fresh = game(); fresh.advance(3.8);
  assert.equal(fresh.state.weaponLevel, 0); assert.equal(fresh.state.resources.length, 0);
});

test('failed safe-spawn attempts do not advance the four-obstacle resource cycle', () => {
  const battle = game(); battle.resize({ left: 0, right: 80, top: 0, bottom: 80 });
  battle.advance(2);
  assert.equal(battle.state.obstacles.length, 0);
  battle.resize(bounds);
  battle.advance(.4, { x: 1, y: 1 });
  const seen = new Set(); const kinds = [];
  for (let i = 0; i < 600 && kinds.length < 4 && !battle.state.ended; i++) {
    battle.advance(1 / 120);
    for (const target of battle.state.obstacles) if (!seen.has(target)) { seen.add(target); kinds.push(target.resource); }
  }
  assert.deepEqual(kinds, [null, null, null, 'weapon']);
});

test('expiration takes priority when the ship reaches a drop on its final step', () => {
  const battle = game(true); battle.advance(4.8);
  const drop = battle.state.resources[0];
  battle.advance(drop.life - 1 / 120);
  battle.resize({ left: 0, right: 800, top: -100, bottom: drop.y + 38 });
  battle.advance(1 / 120);
  assert.equal(battle.state.weaponLevel, 0);
  assert.ok(!battle.state.resources.includes(drop));
});
