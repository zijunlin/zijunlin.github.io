import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../../src/features/work-games/battle.js';
const bounds = { left: 0, right: 800, top: 0, bottom: 600 };
test('touch targets stop exactly without overshoot across accumulated steps', () => {
  const battle = createBattle({ bounds });
  const target = { x: battle.state.ship.x + 3, y: battle.state.ship.y - 2 };
  battle.advance(.1, { target, x: 0, y: 0 });
  assert.equal(battle.state.ship.x, target.x);
  assert.equal(battle.state.ship.y, target.y);
  assert.equal(battle.state.ship.vx, 0);
  const stopped = { ...battle.state.ship };
  battle.advance(.1, { x: 0, y: 0 });
  assert.equal(battle.state.ship.x, stopped.x);
  assert.equal(battle.state.ship.y, stopped.y);
});
test('actual horizontal velocity becomes zero when the ship reaches the boundary', () => {
  const battle = createBattle({ bounds });
  battle.advance(1.1, { x: 1, y: 0 });
  assert.equal(battle.state.ship.x, bounds.right - 13.2);
  assert.equal(battle.state.ship.vx, 0);
});
