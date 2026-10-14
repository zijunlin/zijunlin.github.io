import { SHIP_SPEED } from './rules.js';

// An ability applies to battle state and returns a presentation-neutral outcome.
// Pickups own effect lists, so future combinations use the same collection path.
function capped(kind, read, write, next, maximum, bonus = 50) {
  return { apply(target) {
    const before = read(target);
    const value = next(before);
    const full = before === maximum;
    if (!full) write(target, value);
    return { kind, full, value: full ? before : value, points: full ? bonus : 0 };
  } };
}
const trajectory = capped('trajectory', s => s.trajectoryCount, (s, v) => { s.trajectoryCount = v; }, v => Math.min(24, v + 1), 24);
const fireRate = capped('fireRate', s => s.fireInterval, (s, v) => { s.fireInterval = v; }, v => v === .16 ? .13 : .11, .11);
const movement = capped('movement', s => s.ship.movementSpeed, (s, v) => { s.ship.movementSpeed = v; }, v => Math.min(SHIP_SPEED.maximum, v + SHIP_SPEED.step), SHIP_SPEED.maximum);
const piercing = capped('piercing', s => s.piercing, (s, v) => { s.piercing = v; }, () => true, true);
const shockwave = capped('shockwave', s => s.shockwaveCharges, (s, v) => { s.shockwaveCharges = v; }, v => Math.min(3, v + 1), 3, 0);
export const pickups = {
  trajectory: { abilities: [trajectory] },
  fireRate: { abilities: [fireRate] },
  movement: { abilities: [movement] },
  piercing: { abilities: [piercing] },
  shockwave: { abilities: [shockwave] },
};
export const dropCycle = ['trajectory', 'fireRate', 'shockwave', 'movement', 'piercing', 'shockwave'];
export function applyPickup(kind, target) {
  return pickups[kind].abilities.map(ability => ability.apply(target));
}
