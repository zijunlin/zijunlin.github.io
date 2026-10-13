// Stable spawn geometry for scenarios that are not testing the fast variant.
// Successful spawns draw type, side, position, heading and base speed, then
// (from nine battle seconds) the independent fast-variant roll.
export function ordinarySpawnRandom(values, seconds) {
  let index = 0;
  return () => {
    const value = index === 5 ? .5 : values()[index];
    index = (index + 1) % (seconds() >= 9 ? 6 : 5);
    return value;
  };
}
