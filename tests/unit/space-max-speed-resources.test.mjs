import test from 'node:test';
import assert from 'node:assert/strict';
import { growthRun, harvest, step } from '../helpers/battle-growth.mjs';

function upgradedDrop() {
  const { battle } = growthRun();
  harvest(battle, state => state.trajectoryCount === 24);
  for (let tick = 0; tick < 240 && !battle.state.resources.length && !battle.state.ended; tick++) battle.advance(step);
  assert.ok(battle.state.resources.length, 'a real post-cap carrier drops within two seconds');
  const drop = battle.state.resources[0];
  // Public resize/clamp places the ship; the wide arena prevents unrelated contact.
  function place(x, y) {
    battle.resize({ left: x - 13.2, right: x + 13.2, top: y - 16.5, bottom: y + 23.1 });
    battle.resize({ left: -3000, right: 3000, top: -3000, bottom: 3000 });
  }
  assert.equal(battle.state.ship.movementSpeed, 690);
  return { battle, drop, place };
}

test('a real drop catches a ship moving at 690, stops outside attraction, and collects once at full growth', () => {
  const { battle, drop, place } = upgradedDrop();
  place(drop.x, drop.y + 100);
  const initial = { x: drop.x, y: drop.y }, shipY = battle.state.ship.y;
  battle.advance(step, { x: 0, y: 1 });
  assert.ok(Math.abs(battle.state.ship.y - shipY - 5.75) < 1e-8);
  assert.ok(Math.abs(drop.y - initial.y - 6) < 1e-8);
  place(drop.x, drop.y + 111);
  const stopped = { x: drop.x, y: drop.y };
  battle.advance(step, { x: 0, y: 1 });
  assert.deepEqual({ x: drop.x, y: drop.y }, stopped);
  assert.equal(drop.vx, 0); assert.equal(drop.vy, 0);
  place(drop.x, drop.y + 20);
  const before = battle.state.score;
  battle.advance(step);
  assert.ok(!battle.state.resources.includes(drop));
  assert.equal(battle.state.score - before, drop.kind === 'shockwave' ? 0 : 50);
  assert.equal(battle.state.trajectoryCount, 24);
  const after = battle.state.score;
  battle.advance(step);
  assert.equal(battle.state.score, after);
});

test('expiration still wins a same-step highest-speed approach after full growth', () => {
  const { battle, drop, place } = upgradedDrop();
  place(2200, 2200);
  battle.advance(drop.life - step);
  assert.ok(battle.state.resources.includes(drop));
  place(drop.x, drop.y + 20);
  const before = battle.state.score;
  battle.advance(step, { x: 0, y: -1 });
  assert.ok(!battle.state.resources.includes(drop));
  assert.equal(battle.state.score, before);
  assert.equal(battle.state.ended, false);
});

test('a lethal contact at highest speed prevents collecting a nearby real capped drop', () => {
  const { battle, drop, place } = upgradedDrop();
  place(drop.x + 1000, drop.y + 1000);
  battle.resize({ left: drop.x - 600, right: drop.x + 600, top: drop.y + 21, bottom: drop.y + 1800 });
  const existing = new Set(battle.state.obstacles);
  let target;
  for (let tick = 0; tick < 60 && !target; tick++) {
    battle.advance(step);
    target = battle.state.obstacles.find(obstacle => !existing.has(obstacle));
  }
  assert.ok(target);
  while (target.warning > 0 && !battle.state.ended) battle.advance(step);
  assert.equal(target.hp, 3);
  assert.ok(battle.state.resources.includes(drop));
  assert.ok(Math.hypot(target.x - drop.x, target.y - drop.y) < 1e-8);
  place(drop.x, drop.y);
  const life = drop.life, score = battle.state.score;
  battle.advance(step, { x: 1, y: 0 });
  assert.equal(battle.state.ended, true);
  assert.ok(battle.state.resources.includes(drop));
  assert.equal(drop.life, life, 'fatal contact skips collection and resource time');
  assert.equal(battle.state.score, score);
  const frozen = structuredClone(battle.state);
  battle.advance(1, { x: 0, y: 0, shockwave: true });
  assert.deepEqual(battle.state, frozen);
});
