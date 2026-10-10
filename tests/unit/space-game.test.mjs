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


test('a damaging attack can defeat a target in one hit without awarding it twice', () => {
  const obstacle = { hp: 3, points: 30 };
  assert.equal(hitObstacle(obstacle, 3), 30);
  assert.equal(hitObstacle(obstacle, 3), 0);
  assert.equal(obstacle.hp, 0);
});


async function topApproach(type = 0) {
  const { createBattle } = await import('../../src/features/work-games/battle.js');
  const sequence = [type, .6, .5, .5, 0];
  let index = 0;
  return createBattle({
    bounds: { left: 0, right: 800, top: 0, bottom: 300 },
    random: () => sequence[index++ % sequence.length],
  });
}

test('the default volley fires two forward shots and four satellites every .16 seconds', async () => {
  const battle = await topApproach();
  battle.advance(1 / 120);
  assert.equal(battle.state.bullets.length, 6);
  assert.equal(battle.state.bullets.filter(shot => shot.vy === -520).length, 2);
  battle.resize({ left: -1000, right: 2000, top: -1000, bottom: 2000 });
  battle.advance(18 / 120);
  assert.equal(battle.state.bullets.length, 6);
  battle.advance(1 / 120);
  assert.equal(battle.state.bullets.length, 12);
});

test('warning targets resist actual shots and a simultaneous forward pair awards one kill', async () => {
  const battle = await topApproach();
  battle.advance(1.6);
  assert.equal(battle.state.score, 0);
  assert.equal(battle.state.obstacles[0].hp, 1);
  battle.advance(15 / 120);
  const pair = battle.state.bullets.filter(shot => Math.abs(shot.x - 400) === 5 && shot.y < 10);
  assert.equal(pair.length, 2);
  battle.advance(1 / 120);
  assert.equal(battle.state.score, 10);
  assert.equal(battle.state.obstacles.length, 0);
  // Both paths cross the target; only the killing shot is consumed.
  assert.equal(battle.state.bullets.filter(shot => Math.abs(shot.x - 400) === 5 && shot.y < 10).length, 1);
  battle.advance(.1);
  assert.equal(battle.state.score, 10);
});

test('a shot that destroys an obstacle takes priority over ship impact in that step', async () => {
  const battle = await topApproach();
  battle.advance(207 / 120);
  // A viewport resize puts the ship in the approaching obstacle's collision path.
  battle.resize({ left: 0, right: 800, top: -100, bottom: 40 });
  battle.advance(1 / 120);
  assert.equal(battle.state.score, 10);
  assert.equal(battle.state.ended, false);
});


test('real forward hits each deal one damage and award nothing before destruction', async () => {
  const battle = await topApproach(.5);
  battle.advance(197 / 120);
  assert.equal(battle.state.obstacles[0].hp, 3);
  battle.advance(1 / 120);
  assert.equal(battle.state.obstacles[0].hp, 1);
  assert.equal(battle.state.score, 0);
  battle.advance(11 / 120);
  assert.equal(battle.state.obstacles.length, 0);
  assert.equal(battle.state.score, 30);
});

test('shockwave consumes one charge, keeps its release center and freezes with battle time', async () => {
  const battle = await topApproach();
  assert.equal(battle.state.shockwaveCharges, 1);
  const origin = { ...battle.state.ship };
  battle.advance(1 / 120, { x: 1, y: 0, shockwave: true });
  assert.equal(battle.state.shockwaveCharges, 0);
  assert.equal(battle.state.shockwaves.length, 1);
  assert.equal(battle.state.shockwaves[0].x, origin.x);
  battle.setPaused(true);
  const frozen = JSON.stringify(battle.state);
  battle.advance(1, { x: 0, y: 0, shockwave: true });
  assert.equal(JSON.stringify(battle.state), frozen);
  battle.setPaused(false);
  battle.advance(.6, { x: 1, y: 0, shockwave: true });
  assert.equal(battle.state.shockwaves.length, 0);
  assert.equal(battle.state.shockwaveCharges, 0);
});

test('an expanding shockwave deals three damage only once and leaves distant targets intact', async () => {
  const { createBattle } = await import('../../src/features/work-games/battle.js');
  const make = () => { const values = [.9, 0, .5, .5, 0]; let i = 0;
    return createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, random: () => values[i++ % 5], reducedMotion: true }); };
  const near = make(); near.advance(1.66);
  assert.equal(near.state.obstacles[0].hp, 5);
  near.resize({ left: 0, right: 180, top: 0, bottom: 300 });
  near.advance(.49, { x: 0, y: 0, shockwave: true });
  assert.equal(near.state.obstacles[0].hp, 2);
  near.advance(.1);
  assert.equal(near.state.obstacles[0].hp, 2);
  const far = make(); far.advance(1.66);
  far.advance(.6, { x: 0, y: 0, shockwave: true });
  assert.equal(far.state.obstacles[0].hp, 5);
});

test('shockwaves respect warnings and use the normal kill score without duplicate settlement', async () => {
  const { createBattle } = await import('../../src/features/work-games/battle.js');
  const make = () => { const values = [.5, 0, .5, .5, 0]; let i = 0;
    return createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, random: () => values[i++ % 5], reducedMotion: true }); };
  const warning = make(); warning.advance(1.05);
  warning.resize({ left: 0, right: 180, top: 0, bottom: 300 });
  warning.advance(.5, { x: 0, y: 0, shockwave: true });
  assert.equal(warning.state.obstacles[0].hp, 3);
  assert.equal(warning.state.score, 0);
  const live = make(); live.advance(1.66);
  live.resize({ left: 0, right: 180, top: 0, bottom: 300 });
  live.advance(.6, { x: 0, y: 0, shockwave: true });
  assert.equal(live.state.score, 30);
  live.advance(.1);
  assert.equal(live.state.score, 30);
});

test('paused Space is consumed, and a fresh battle restores its initial reserve', async () => {
  const battle = await topApproach();
  battle.setPaused(true);
  battle.advance(.1, { x: 0, y: 0, shockwave: true });
  battle.setPaused(false);
  battle.advance(.1, { x: 0, y: 0, shockwave: true });
  assert.equal(battle.state.shockwaveCharges, 1);
  battle.advance(.01);
  battle.advance(.01, { x: 0, y: 0, shockwave: true });
  assert.equal(battle.state.shockwaveCharges, 0);
  const replay = await topApproach();
  assert.equal(replay.state.shockwaveCharges, 1);
  assert.deepEqual(replay.state.shockwaves, []);
});

test('a Space edge between simulation steps is retained until the next step', async () => {
  const battle = await topApproach();
  battle.advance(.001, { x: 0, y: 0, shockwave: true });
  battle.advance(.008);
  assert.equal(battle.state.shockwaveCharges, 0);
});
