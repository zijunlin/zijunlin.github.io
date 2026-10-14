import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createBattle } from '../../src/features/work-games/battle.js';
import { ordinarySpawnRandom } from '../helpers/ordinary-spawn-random.js';
import { advanceUntil, moveUntilFeedback } from '../helpers/game-scenario.js';
import { hardwareProblems, observeProductionBattle, performanceRandom, productionGameBundle, startObservation, workloadProblems } from '../helpers/game-performance.js';

test('random scenario survives 16 rejected positions, then recovers with correct type, speed and fast classification', () => {
  let values = [.9, .9, .5, .5, 0];
  const purposes = [];
  const ordinary = ordinarySpawnRandom(() => values);
  const battle = createBattle({ bounds: { left: 0, right: 800, top: 0, bottom: 300 }, random: purpose => { purposes.push(purpose); return ordinary(purpose); }, reducedMotion: true });
  battle.advance(1.01);
  assert.equal(battle.state.obstacles.length, 0);
  assert.equal(purposes.filter(p => p === 'position').length, 16);
  assert.ok(!purposes.includes('heading'));
  values = [.9, .6, .5, .5, 0];
  battle.advance(1);
  assert.equal(battle.state.obstacles[0].radius, 30);
  assert.equal(battle.state.obstacles[0].hp, 5);
  assert.ok(Math.abs(Math.hypot(battle.state.obstacles[0].vx, battle.state.obstacles[0].vy) - 22.4 * 510 / 390) < .001);
  assert.equal(battle.state.obstacles[0].fast, false);
  battle.advance(8);
  assert.ok(purposes.includes('fast'));
  assert.ok(battle.state.obstacles.every(o => !o.fast));
});

test('performance variant rolls ignore setup draws and arbitrary position retries', () => {
  let measuring = false;
  const random = performanceRandom(() => measuring);
  for (let i = 0; i < 200; i++) assert.equal(random('fast'), .5);
  measuring = true;
  const variants = [];
  for (let i = 0; i < 14; i++) {
    for (let retry = 0; retry < i; retry++) { random('side'); random('position'); }
    variants.push(random('fast'));
  }
  assert.deepEqual(variants, [.5,.5,.5,.5,.5,.5,.1,.5,.5,.5,.5,.5,.5,.1]);
});

test('production observer supports query strings and fails closed when the constructor changes', () => {
  assert.ok(productionGameBundle.test('http://localhost/assets/space-game-ab.js?attempt=1'));
  assert.ok(!productionGameBundle.test('http://localhost/src/features/work-games/space-game.js'));
  assert.throws(() => observeProductionBattle('function different() {}'), /signature changed/);
  const context = { window: {} };
  vm.runInNewContext(observeProductionBattle('function a({bounds:b,random:r=Math.random,reducedMotion:m=!1}) {return {state:{sample:r("type")}}}') + ';a({});', context);
  assert.equal(context.window.battleSnapshot.sample, .5);
  context.window.battleSnapshot.sample = 0;
  assert.equal(context.window.battleSnapshot.sample, .5, 'snapshot cannot mutate actual battle');
});

const validWorkload = { done: true, seconds: 180, attributesValid: true, fullForwardCohort: true, fast: 1, ordinary: 1, coexisting: true, shipDistance: 200, backgroundDraws: 2000 };
test('preflight rejects the clock and random-phase failures before a full measurement', () => {
  assert.deepEqual(workloadProblems(validWorkload), []);
  assert.match(workloadProblems({ ...validWorkload, backgroundDraws: 0 }).join(), /background/);
  assert.match(workloadProblems({ ...validWorkload, fast: 0 }).join(), /obstacles/);
  for (const field of ['attributesValid', 'fullForwardCohort', 'coexisting']) assert.ok(workloadProblems({ ...validWorkload, [field]: false }).length);
  for (const field of ['interrupted', 'ended']) assert.ok(workloadProblems({ ...validWorkload, [field]: true }).length);
  assert.ok(workloadProblems({ ...validWorkload, seconds: 12 }, { final: true }).length);
  assert.ok(hardwareProblems('ANGLE SwiftShader', { featureStatus: { gpu_compositing: 'enabled' } }).length);
  assert.ok(hardwareProblems('Intel', {}).length);
});

test('measurement starts a fresh clock and retains a transient complete volley', () => {
  const callbacks = [];
  const state = { ship: { x: 0, y: 0, movementSpeed: 690 }, trajectoryCount: 24, fireInterval: .11, piercing: true,
    obstacles: [{ fast: true }, { fast: false }], bullets: Array.from({ length: 24 }, () => ({ piercing: true, life: 1.9 })) };
  const context = { window: { battleSnapshot: state, backgroundDraws: 3 }, performance: { now: () => 100 },
    document: { hidden: false, hasFocus: () => true, querySelector: () => null }, requestAnimationFrame: callback => callbacks.push(callback) };
  vm.runInNewContext(`(${startObservation.toString()})(30)`, context);
  callbacks.shift()(110);
  state.bullets = []; state.ship = { ...state.ship, x: 120 };
  callbacks.shift()(140);
  assert.equal(context.window.measurement.fullForwardCohort, true);
  assert.equal(context.window.measurement.shipDistance, 120);
  assert.equal(context.window.measurement.intervals[0], 30);
  assert.equal(context.window.measurement.done, true);
});

test('clock polling catches a transient event, respects its deadline, and releases keys on failure', async () => {
  let elapsed = 0;
  const page = { clock: { runFor: async n => { elapsed += n; } }, keyboard: { down: async () => {}, up: async () => { released = true; } }, locator: () => ({ textContent: async () => '' }) };
  let released = false;
  assert.equal(await advanceUntil(page, () => elapsed >= 200 && elapsed < 300), 200);
  await assert.rejects(advanceUntil(page, () => false, { timeout: 250, description: 'yellow marker' }), /250 game ms.*yellow marker/);
  assert.equal(elapsed, 450);
  await assert.rejects(moveUntilFeedback(page, 'ArrowUp', 'pickup', { timeout: 100 }), /pickup/);
  assert.ok(released);
});
