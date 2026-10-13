import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';

// A large arena keeps targets alive and out of the automatic weapon range.
function scenario(roll, type = .5) {
  let battle, index = 0;
  const values = [type, 0, .1, .5, .5];
  battle = createBattle({ bounds: { left: 0, right: 10000, top: 0, bottom: 10000 }, reducedMotion: true,
    random: () => {
      const length = battle.state.seconds >= 9 ? 6 : 5;
      const value = index === 5 ? roll : values[index];
      index = (index + 1) % length;
      return value;
    },
  });
  return battle;
}

test('fast obstacles begin after nine battle seconds and the fifteen percent boundary changes actual motion', () => {
  const fast = scenario(.149999), ordinary = scenario(.15);
  fast.advance(9); ordinary.advance(9);
  assert.ok(fast.state.obstacles.length > 0);
  assert.ok(fast.state.obstacles.every(target => !target.fast));
  const count = fast.state.obstacles.length;
  while (fast.state.obstacles.length === count) { fast.advance(1 / 120); ordinary.advance(1 / 120); }
  const quick = fast.state.obstacles.at(-1), normal = ordinary.state.obstacles.at(-1);
  const origin = { x: quick.x, y: quick.y };
  assert.ok(Math.hypot(quick.x - fast.state.ship.x, quick.y - fast.state.ship.y) >= 210);
  fast.advance(.6); ordinary.advance(.6);
  assert.deepEqual({ x: quick.x, y: quick.y }, origin);
  assert.equal(quick.hp, normal.hp);
  assert.equal(quick.points, normal.points);
  assert.equal(quick.resource, normal.resource);
  fast.advance(.3); ordinary.advance(.3);
  const distance = target => Math.hypot(target.x - origin.x, target.y - origin.y);
  assert.ok(distance(normal) > 0);
  assert.ok(Math.abs(distance(quick) - 2 * distance(normal)) < 1e-8);
});

test('fast routes remain fixed through ship turns, difficulty increases and pause for every size', () => {
  for (const type of [.1, .5, .9]) {
    const battle = scenario(.01, type);
    battle.advance(10.2);
    const target = battle.state.obstacles.find(obstacle => obstacle.fast);
    assert.ok(target);
    const before = { x: target.x, y: target.y };
    battle.advance(.1);
    const dx = target.x - before.x, dy = target.y - before.y;
    battle.advance(8, { x: 1, y: -1 });
    const after = { x: target.x, y: target.y };
    battle.advance(.1, { x: -1, y: 1 });
    assert.ok(Math.abs(target.x - after.x - dx) < 1e-8);
    assert.ok(Math.abs(target.y - after.y - dy) < 1e-8);
    battle.setPaused(true);
    const frozen = JSON.stringify(battle.state);
    battle.advance(10);
    assert.equal(JSON.stringify(battle.state), frozen);
    const replay = scenario(.01, type);
    replay.advance(8.99);
    assert.ok(replay.state.obstacles.every(obstacle => !obstacle.fast));
  }
});

test('a fast carrier resists shots during warning, then awards one kill and one real drop', () => {
  let battle, index = 0;
  battle = createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, reducedMotion: true,
    random: () => {
      const value = [0, .6, .5, .5, 0, .01][index];
      index = (index + 1) % (battle.state.seconds >= 9 ? 6 : 5);
      return value;
    },
  });
  let carrier;
  while (!carrier && battle.state.seconds < 14) {
    battle.advance(1 / 120);
    carrier = battle.state.obstacles.find(target => target.fast && target.resource);
  }
  assert.ok(carrier);
  const origin = { x: carrier.x, y: carrier.y };
  while (carrier.warning > 1 / 120) {
    battle.advance(1 / 120);
    assert.equal(carrier.hp, 1);
    assert.deepEqual({ x: carrier.x, y: carrier.y }, origin);
  }
  const score = battle.state.score;
  while (carrier.hp > 0 && battle.state.seconds < 15) battle.advance(1 / 120);
  assert.equal(carrier.hp, 0);
  assert.equal(battle.state.score - score, 10);
  const drops = battle.state.resources.filter(resource => resource.kind === carrier.resource && resource.life > 7.99);
  assert.equal(drops.length, 1);
  battle.advance(.1);
  assert.equal(battle.state.score - score, 10);
  assert.ok(battle.state.resources.includes(drops[0]));
});

test('shockwaves destroy a fast carrier once and fast ship contacts end a battle', () => {
  const battle = scenario(.01);
  let carrier;
  while (!carrier && battle.state.seconds < 14) {
    battle.advance(1 / 120);
    carrier = battle.state.obstacles.find(target => target.fast && target.resource);
  }
  assert.ok(carrier);
  while (carrier.warning > 0) battle.advance(1 / 120);
  const x = carrier.x + 100, y = carrier.y;
  battle.resize({ left: x - 13.2, right: x + 13.2, top: y - 16.5, bottom: y + 23.1 });
  battle.resize({ left: -1000, right: 10000, top: 0, bottom: 10000 });
  battle.advance(.3, { x: 0, y: 0, shockwave: true });
  assert.equal(carrier.hp, 0);
  assert.ok(battle.state.pickupFeedback > 0 || battle.state.resources.some(resource => resource.kind === carrier.resource));
  battle.advance(.05);
  assert.equal(carrier.hp, 0);
  assert.ok(!battle.state.obstacles.includes(carrier));

  const impact = scenario(.01);
  impact.advance(10.2);
  const target = impact.state.obstacles.find(obstacle => obstacle.fast);
  impact.resize({ left: target.x - 13.2, right: target.x + 13.2, top: target.y - 16.5, bottom: target.y + 23.1 });
  impact.resize({ left: -1000, right: 10000, top: 0, bottom: 10000 });
  impact.advance(1 / 120);
  assert.equal(impact.state.ended, true);
});
