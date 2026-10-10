// A single module instance owns entry state for both background and scene.
// Keep the existing storage key so sessions created by earlier versions survive.
function entrySeed() {
  const supplied = new URLSearchParams(location.search).get('seed');
  if (supplied?.trim() && Number.isFinite(Number(supplied))) {
    return Math.max(0, Math.min(999999, Math.floor(Number(supplied))));
  }
  try {
    const stored = sessionStorage.getItem('world-entry-seed');
    const value = Number(stored);
    if (stored?.trim() && Number.isSafeInteger(value) && value >= 0) return value;
  } catch { /* Restricted storage still allows one stable in-memory entry. */ }
  const timestamp = Date.now();
  try {
    sessionStorage.setItem('world-entry-seed', String(timestamp));
  } catch { /* Do not let storage restrictions prevent the world from loading. */ }
  return timestamp;
}

function mixSeed(value) {
  let n = value | 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

const seed = entrySeed();
const randomBits = mixSeed(seed);
// Preserve the existing seeded layout and background across reloads.
const layoutRandom = (randomBits >>> 16) / 65536;

export const worldState = Object.freeze({
  seed,
  layout: layoutRandom < 0.5 ? 'A' : 'B',
  backgroundSeed: randomBits / 4294967296,
});
