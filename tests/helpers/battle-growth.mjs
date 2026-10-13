import { ordinarySpawnRandom } from './ordinary-spawn-random.js';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
export const growthBounds = { left: 0, right: 800, top: 0, bottom: 300 };
export const step = 1 / 120;
export function growthRun() {
  let draws = 0, sequence = [.5, .5, .5, .5, .5];
  const battle = createBattle({ bounds: growthBounds, reducedMotion: true, random: ordinarySpawnRandom(() => {
    draws++;
    return sequence;
  }) });
  return { battle, setRandom(value) { sequence = value; }, get draws() { return draws; } };
}
export function collectDrop(battle, drop) {
  battle.resize({ ...growthBounds, top: -100, bottom: drop.y + 23.1 });
  battle.advance(step);
  battle.resize({ ...growthBounds, top: 238.5, bottom: 500 });
  battle.resize(growthBounds);
}
export function harvest(battle, done, observe = () => {}) {
  while (!done(battle.state) && battle.state.seconds < 240 && !battle.state.ended) {
    battle.advance(step);
    if (battle.state.resources.length) {
      const drop = battle.state.resources[0];
      const before = { bullets: battle.state.bullets.map(bullet => [bullet, bullet.piercing]), score: battle.state.score, trajectoryCount: battle.state.trajectoryCount, fireInterval: battle.state.fireInterval, movementSpeed: battle.state.ship.movementSpeed, piercing: battle.state.piercing, shockwaveCharges: battle.state.shockwaveCharges };
      collectDrop(battle, drop);
      observe(drop, before, battle.state);
    }
  }
  assert.equal(battle.state.ended, false, 'harvesting real generated drops remains alive');
  assert.ok(done(battle.state), 'requested real growth reached within 240 seconds');
}
