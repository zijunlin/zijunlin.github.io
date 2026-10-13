// Read values by purpose so failed positions and the nine-second fast gate cannot
// shift later samples. A scenario may change its geometry between advances.
export function ordinarySpawnRandom(values) {
  const slots = { type: 0, side: 1, position: 2, heading: 3, speed: 4 };
  return purpose => {
    if (purpose === 'fast') return .5;
    if (!Object.hasOwn(slots, purpose)) throw new Error(`Unknown battle random purpose: ${purpose}`);
    return values()[slots[purpose]];
  };
}
