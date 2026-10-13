import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';

const dt = 1 / 120;
const bounds = { left: 0, right: 800, top: 0, bottom: 300 };
const wide = { left: -3000, right: 3000, top: -3000, bottom: 3000 };
function scenario(waveAt = null, release = true, maximum = false) {
  let sequence = maximum ? [.5, .5, .5, .5, .5] : [0, .6, .5, .5, 0], index = 0, fast = false;
  const battle = createBattle({ bounds, random: () => {
    const value = index === 5 ? (fast ? .01 : .5) : sequence[index];
    index = (index + 1) % (battle.state.seconds >= 9 ? 6 : 5);
    return value;
  }, reducedMotion: true });
  function place(x, y) {
    battle.resize({ left: x - 13.2, right: x + 13.2, top: y - 16.5, bottom: y + 23.1 });
    battle.resize(wide);
  }
  while ((maximum ? battle.state.trajectoryCount < 24 : !battle.state.piercing) && battle.state.seconds < 240 && !battle.state.ended) {
    if (battle.state.resources.length) {
      battle.resize({ ...bounds, top: -100, bottom: battle.state.resources[0].y + 23.1 });
      battle.advance(dt);
      battle.resize({ ...bounds, top: 238.5, bottom: 500 }); battle.resize(bounds);
    } else battle.advance(dt);
  }
  assert.equal(battle.state.piercing, true);
  fast = maximum;
  const growthEnd = battle.state.seconds;
  place(2000, 0);
  let target, spawned = 0;
  // Keep earlier targets away from the shot path; the next cycle carrier is the contact target.
  while (!target && battle.state.seconds < growthEnd + 8) {
    const y = spawned < (maximum ? 1 : 3) ? 600 : 0;
    battle.resize({ left: 30, right: 2100, top: -100, bottom: 700 });
    sequence = [.9, 0, (y + 100) / 800, .5 - Math.atan2(-y, 2000) / .9, 0];
    const previous = new Set(battle.state.obstacles);
    battle.advance(dt);
    for (const obstacle of battle.state.obstacles) if (!previous.has(obstacle)) {
      spawned++; if (obstacle.resource) target = obstacle;
    }
  }
  assert.equal(spawned, maximum ? 2 : 4);
  assert.equal(target.fast, maximum);
  if (maximum) assert.equal(battle.state.trajectoryCount, 24);
  assert.equal(target.hp, 5);
  battle.resize({ left: 30, right: 2100, top: -100, bottom: 100 });
  while (target.warning > 0 && !battle.state.ended) battle.advance(dt);
  assert.equal(target.warning, 0);
  battle.resize(wide); sequence = [.9, 0, .5, .5, 0];
  // Aim the outer fan ray at the moving target, independently of the central satellite ray.
  const angle = maximum ? Math.PI / 3 : Math.PI / 30;
  const height = maximum ? 400 : 650, flight = (height - 12 - 32) / (520 * Math.cos(angle));
  place(target.x + (target.vx - 520 * Math.sin(angle)) * flight, height);
  let previousHP = target.hp;
  const changes = [];
  for (let step = 0; step < 500; step++) {
    const score = battle.state.score, charges = battle.state.shockwaveCharges, resources = battle.state.resources.length;
    let contactBullet;
    if (step === waveAt) {
      assert.equal(target.hp, 4);
      contactBullet = battle.state.bullets.find(bullet => bullet.piercing && bullet.vx > 20 && Math.abs(bullet.y - target.y) < 40);
      assert.ok(contactBullet, 'a real piercing bolt is approaching');
      place(target.x + 32, target.y);
    }
    battle.advance(dt, { x: 0, y: 0, shockwave: step === waveAt && release });
    if (target.hp !== previousHP) {
      changes.push({ step, hp: target.hp }); previousHP = target.hp;
      if (waveAt === null && changes.length === 2) return changes;
    }
    if (step !== waveAt) continue;
    assert.ok(battle.state.bullets.includes(contactBullet), 'piercing bolt survives its first target');
    if (!release) {
      assert.equal(target.hp, 3, 'the bolt deals one damage in this exact step');
      assert.equal(battle.state.ended, true, 'the surviving target collides with the ship');
    } else {
      assert.equal(target.hp, 0, 'one piercing damage and three wave damage jointly kill');
      assert.equal(battle.state.score - score, 60);
      assert.equal(battle.state.resources.length - resources, 1);
      assert.equal(battle.state.shockwaveCharges, charges - 1);
      assert.equal(battle.state.ended, false, 'the mixed attack kill wins the ship collision');
      const chargesAfter = battle.state.shockwaveCharges;
      battle.advance(dt * 3);
      assert.equal(battle.state.score - score, maximum ? 110 : 60, 'one kill and, when capped, one pickup bonus');
      // Faster attraction now collects this nearby drop within three steps.
      assert.equal(battle.state.resources.length - resources, 0);
      assert.equal(battle.state.shockwaveCharges, chargesAfter + (maximum ? 0 : 1));
      if (maximum) {
        assert.equal(battle.state.pickupScore, 50);
        assert.equal(battle.state.pickupResults.length, 1);
      }
    }
    return changes;
  }
  assert.fail('expected contact occurred within the bounded replay');
}

test('a piercing bolt and shockwave jointly kill once in one step before ship collision', () => {
  const contacts = scenario();
  assert.deepEqual(contacts.map(contact => contact.hp), [4, 3]);
  const waveAt = contacts[1].step;
  scenario(waveAt, false);
  scenario(waveAt, true);
});

test('max 24 trajectories and a wave settle a fast carrier only once before ship contact', () => {
  const contacts = scenario(null, true, true);
  assert.deepEqual(contacts.map(contact => contact.hp), [4, 3]);
  scenario(contacts[1].step, false, true);
  scenario(contacts[1].step, true, true);
});
