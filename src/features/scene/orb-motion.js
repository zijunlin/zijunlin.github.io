import { orbScale } from './orb-scene.js';

const mix = (a, b, t) => a + (b - a) * t;
const clamp = value => Math.max(0, Math.min(1, value));
// Match the existing CSS timing curves without animation nodes or a second RAF.
function bezier(x, x1, y1, x2, y2) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const coordinate = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let low = 0, high = 1;
  for (let i = 0; i < 14; i++) {
    const t = (low + high) / 2;
    if (coordinate(t, x1, x2) < clamp(x)) low = t; else high = t;
  }
  return coordinate((low + high) / 2, y1, y2);
}
function interpolate(t, stops) {
  const end = stops.findIndex(([offset]) => offset >= t);
  if (end <= 0) return stops[Math.max(0, end)][1];
  const [a, b] = [stops[end - 1], stops[end]];
  return mix(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
}

// The scene owns numerical animation state shared by home orbs and the
// game satellites through captured appearance values.
export function createOrbMotion(definition, { reduced = false } = {}) {
  let expanded = false, paused = false, pulseTime = 0, particleTime = 0;
  let transition = 650, scaleFrom = orbScale(false), scaleTo = scaleFrom;
  let opacityFrom = 0, opacityTo = 0, pressTime = 220;
  function pose() {
    const cycle = ((pulseTime - definition.pulseDelay) / 3400) % 2;
    const pulse = bezier(cycle <= 1 ? cycle : 2 - cycle, .42, 0, .58, 1);
    return {
      scale: mix(scaleFrom, scaleTo, bezier(transition / 650, .2, .8, .2, 1)),
      translateX: reduced || pressTime >= 220 ? 0 : interpolate(bezier(pressTime / 220, 0, 0, .58, 1), [[0, 0], [1 / 3, -2], [2 / 3, 2], [1, 0]]),
      pulseScale: reduced ? 1 : mix(.85, 1.12, pulse),
      pulseOpacity: reduced ? 1 : mix(.3, .85, pulse),
      particlesOpacity: mix(opacityFrom, opacityTo, bezier(transition / 600, .25, .1, .25, 1)),
      particles: definition.particles.map(particle => {
        const phase = ((particleTime - particle.delay) / particle.duration) % 1;
        return { angle: particle.angle + (reduced ? 0 : phase * (particle.infalling ? 300 : 360)),
          offset: reduced || !particle.infalling ? 0 : -particle.radius * phase,
          opacity: !particle.infalling ? .85 : reduced ? 1 : interpolate(phase, [[0, 0], [.12, 1], [.75, .9], [1, 0]]),
        };
      }),
    };
  }
  function setExpanded(value, immediate = false) {
    if (expanded === value && !immediate) return;
    const current = pose(); expanded = value;
    scaleFrom = current.scale; scaleTo = orbScale(value);
    opacityFrom = current.particlesOpacity; opacityTo = value ? .95 : 0;
    transition = reduced || immediate ? 650 : 0;
    if (reduced || immediate) { scaleFrom = scaleTo; opacityFrom = opacityTo; }
  }
  return {
    advance(dt) {
      transition = Math.min(650, transition + dt); pressTime = Math.min(220, pressTime + dt);
      if (!reduced && !paused) { pulseTime += dt; if (expanded) particleTime += dt; }
    },
    setExpanded,
    setPaused(value) { paused = value; },
    setReducedMotion(value) {
      reduced = value; pulseTime = particleTime = 0;
      if (reduced) { pressTime = 220; setExpanded(expanded, true); }
    },
    press() { if (!reduced) pressTime = 0; },
    snapshot: () => ({ definition, pose: pose() }),
    returnAppearance() { return { definition, pose: { ...pose(), scale: orbScale(false), translateX: 0, particlesOpacity: 0 } }; },
  };
}
