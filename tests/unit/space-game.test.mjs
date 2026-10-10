import test from 'node:test';
import assert from 'node:assert/strict';
import { intersectsSweep, difficultyAt, hitObstacle } from '../../src/features/work-games/rules.js';

test('swept collisions catch a fast shot crossing a small obstacle between frames', () => {
  assert.equal(intersectsSweep({ x: 0, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 50 }, 14), true);
  assert.equal(intersectsSweep({ x: 0, y: 65 }, { x: 100, y: 65 }, { x: 50, y: 50 }, { x: 50, y: 50 }, 14), false);
});
test('difficulty increases every 9 seconds and reaches its cap at 45 seconds', () => {
  assert.deepEqual(difficultyAt(0), { level: 0, interval: 1 });
  assert.equal(difficultyAt(8.99).level, 0);
  assert.deepEqual(difficultyAt(9), { level: 1, interval: .856 });
  assert.equal(difficultyAt(27).level, 3);
  assert.ok(Math.abs(difficultyAt(27).interval - .568) < 1e-10);
  assert.equal(difficultyAt(44.99).level, 4);
  assert.deepEqual(difficultyAt(45), { level: 5, interval: .28 });
  assert.deepEqual(difficultyAt(1000), { level: 5, interval: .28 });
});
test('only a killing hit awards the obstacle score, once', () => {
  const obstacle = { hp: 3, points: 30 };
  assert.equal(hitObstacle(obstacle), 0);
  assert.equal(hitObstacle(obstacle), 0);
  assert.equal(hitObstacle(obstacle), 30);
  assert.equal(hitObstacle(obstacle), 0);
});

test('battle pause freezes time and movement, and diagonal movement is normalized', async () => {
  const { createBattle } = await import('../../src/features/work-games/battle.js');
  const battle = createBattle({ bounds: { left: 0, right: 1000, top: 0, bottom: 1000 }, random: () => .5 });
  const start = { ...battle.state.ship };
  battle.advance(.1, { x: 1, y: -1 });
  assert.ok(Math.abs(Math.hypot(battle.state.ship.x - start.x, battle.state.ship.y - start.y) - 30) < .001);
  battle.setPaused(true);
  const frozen = JSON.stringify(battle.state);
  battle.advance(100, { x: 1, y: 0 });
  assert.equal(JSON.stringify(battle.state), frozen);
  battle.setPaused(false);
  battle.advance(.1, { x: 0, y: 0 });
  assert.ok(Math.abs(battle.state.seconds - .2) < .001);
});

test('30 and 120 FPS produce the same hits, score and survival time', async () => {
  const { createBattle } = await import('../../src/features/work-games/battle.js');
  const play = fps => {
    const battle = createBattle({ bounds: { left: 0, right: 1000, top: 0, bottom: 1000 }, random: () => .5 });
    for (let i = 0; i < 12 * fps; i++) battle.advance(1 / fps);
    return battle.state;
  };
  const slow = play(30), fast = play(120);
  assert.deepEqual(slow, fast);
  assert.ok(slow.score > 0);
  assert.ok(slow.obstacles.length <= 45);
});

test('a ship impact ends the battle and further time cannot change its result', async () => {
  const { createBattle } = await import('../../src/features/work-games/battle.js');
  const battle = createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 600 }, random: () => .4 });
  for (let i = 0; i < 120 * 30 && !battle.state.ended; i++) {
    const target = battle.state.obstacles[0];
    const ship = battle.state.ship;
    battle.advance(1 / 120, target ? { x: Math.sign(target.x - ship.x), y: Math.sign(target.y - ship.y) } : { x: 0, y: 0 });
  }
  assert.equal(battle.state.ended, true);
  const result = JSON.stringify(battle.state);
  battle.advance(10);
  assert.equal(JSON.stringify(battle.state), result);
});
