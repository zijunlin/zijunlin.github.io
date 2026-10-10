import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';

const STEP = 1 / 120;
const bounds = { left: 0, right: 800, top: 0, bottom: 300 };
const snapshot = battle => JSON.parse(JSON.stringify(battle.state));
function setup() {
  let sequence = [0, .6, .5, .5, 0], draws = 0;
  const battle = createBattle({ bounds, random: () => sequence[draws++ % 5], reducedMotion: true });
  return { battle, setRandom: value => { sequence = value; }, get draws() { return draws; } };
}
function apply(run, event) {
  switch (event.type) {
    case 'resize': run.battle.resize(event.value); break;
    case 'input': run.input = event.value; break;
    case 'pause': run.battle.setPaused(event.value); break;
    case 'random': run.setRandom(event.value); break;
    case 'check': assert.deepEqual(snapshot(run.battle), event.value); break;
  }
}

test('one complete growth, refill, bonus, wave, pause and terminal replay agrees at 30, 60 and 120 FPS', () => {
  const record = setup(), events = [], levels = [], refills = [];
  let tick = 0, restore = false, afterBonus = null, pausedSnapshot, endedSnapshot;
  function emit(type, value) {
    const event = { tick, type, value };
    events.push(event); apply(record, event);
  }
  emit('input', { x: 0, y: 0, shockwave: true });
  for (; tick < 6000; tick++) {
    const state = record.battle.state;
    if (tick === 1) emit('input', { x: 0, y: 0, shockwave: false });
    if (restore) {
      emit('resize', { ...bounds, top: 217, bottom: 500 });
      emit('resize', bounds); restore = false;
    }
    // Real drops are collected using the public resize/clamp behavior, never state mutation.
    if (afterBonus === null && state.resources.length) {
      emit('resize', { ...bounds, top: -100, bottom: state.resources[0].y + 38 });
      restore = true;
    }
    if (afterBonus === null && state.pickupScore === 50) {
      assert.equal(state.weaponLevel, 4);
      afterBonus = tick;
      emit('input', { x: 0, y: 0, shockwave: true });
    }
    if (afterBonus !== null) {
      const elapsed = tick - afterBonus;
      if (elapsed === 5) {
        emit('pause', true); pausedSnapshot = snapshot(record.battle);
        assert.ok(pausedSnapshot.shockwaves[0].radius > 0);
      }
      if (elapsed === 125) {
        assert.deepEqual(snapshot(record.battle), pausedSnapshot);
        emit('check', pausedSnapshot); emit('pause', false);
      }
      if (elapsed === 130) emit('input', { x: 0, y: 0, shockwave: false });
      if (elapsed === 190) {
        emit('random', [.9, 0, .5, .5, 0]);
        emit('resize', { left: -1000, right: 2000, top: -1000, bottom: 1000 });
      }
      if (elapsed > 190 && !state.ended) {
        const target = state.obstacles.find(target => target.hp === 5 && target.warning === 0);
        if (target) {
          emit('resize', { left: target.x - 38, right: target.x + 38, top: target.y - 38, bottom: target.y + 38 });
          emit('resize', { left: -3000, right: 3000, top: -3000, bottom: 3000 });
        }
      }
    }
    const beforeLevel = state.weaponLevel, beforeCharges = state.shockwaveCharges;
    record.battle.advance(STEP, record.input);
    if (state.weaponLevel !== beforeLevel) levels.push(state.weaponLevel);
    if (state.shockwaveCharges > beforeCharges) refills.push(state.shockwaveCharges);
    if (state.ended) {
      endedSnapshot = snapshot(record.battle); tick++; emit('check', endedSnapshot); break;
    }
  }
  assert.deepEqual(levels, [1, 2, 3, 4]);
  assert.deepEqual(refills, [1, 2]);
  assert.ok(afterBonus !== null, 'a max-level drop awards 50 points');
  assert.ok(endedSnapshot, 'a real obstacle collision ends the run');
  assert.equal(endedSnapshot.score, 340);
  assert.equal(endedSnapshot.shockwaveCharges, 1);
  record.battle.advance(2, { x: 1, y: 1, shockwave: true });
  assert.deepEqual(snapshot(record.battle), endedSnapshot);
  const endTick = tick + 240;

  // Reuse precisely the same command timeline; lower-FPS replays do not recompute pickup decisions.
  for (const fps of [30, 60, 120]) {
    const run = setup(); let current = 0, index = 0;
    while (current < endTick) {
      while (index < events.length && events[index].tick === current) apply(run, events[index++]);
      const nextEvent = index < events.length ? events[index].tick : endTick;
      const ticks = Math.min(120 / fps, nextEvent - current, endTick - current);
      assert.ok(ticks > 0);
      run.battle.advance(ticks * STEP, run.input); current += ticks;
    }
    assert.equal(index, events.length);
    assert.deepEqual(snapshot(run.battle), endedSnapshot, `${fps} FPS observable combat state`);
    assert.equal(run.draws, record.draws, `${fps} FPS random draws`);
  }
});
