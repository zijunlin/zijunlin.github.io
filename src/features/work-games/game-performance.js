import { createOrbLayer } from '../scene/orb-layer.js';
import { createBattleComposite } from './battle-composite.js';
import { createShipLayer } from './ship-layer.js';
import { returningOrbAppearance } from '../scene/orb-scene.js';
import { shipAppearance } from './ship-appearance.js';

const clamp = value => Math.max(0, Math.min(1, value));
const blend = (from, to, progress) => from + (to - from) * progress;
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Render the approved diamond formation using captured viewport coordinates.
function mountArtwork(graphics, captures, reduced, scale, onFrame, effects) {
  const satellites = captures.map(capture => ({ ...capture, opacity: 1 }));
  const appearances = captures.map(capture => capture.appearance);
  const ship = { x: 0, y: 0, opacity: 0, scale };
  let disposed = false;
  const layer = graphics.addLayer((gl, resources) => {
    const combat = createBattleComposite(gl, resources, effects);
    const orbs = createOrbLayer(gl, resources, () => satellites);
    const hull = createShipLayer(gl, resources, () => ship);
    return { draw(frame) {
      // Advance input, simulation and formation before submitting either visual.
      if (frame.animated) onFrame(frame.elapsed * 1000);
      if (disposed) return;
      combat.draw(frame); orbs.draw(frame); hull.draw(frame);
    } };
  });
  function render(time, orbitTime, bounds, center, dt = 0) {
    const down = ease((time - 1.8) / 1.2);
    const cx = (bounds.left + bounds.right) / 2;
    const cy = Math.max(bounds.top + 62, (bounds.bottom + 20) * .44);
    const shipX = center?.x ?? cx;
    const shipY = center?.y ?? blend(cy, bounds.bottom - 45, down);
    satellites.forEach((satellite, i) => {
      const capture = captures[i];
      const startAngle = Math.atan2(capture.y - cy, capture.x - cx);
      const angle = blend(startAngle, i * Math.PI / 2 - Math.PI / 2, ease(time / .85))
        + ease((time - .85) / .9) * Math.PI / 2 + (reduced ? 0 : orbitTime * Math.PI / 3);
      const radius = blend(62, 30, ease((time - 1.4) / 1.3));
      const gather = 1 - (1 - clamp(time / .85)) ** 3;
      const x = reduced ? blend(capture.x, shipX + Math.cos(i * Math.PI / 2) * 30, ease(time / 3))
        : blend(capture.x, shipX + Math.cos(angle) * radius, gather);
      const y = reduced ? blend(capture.y, (center?.y ?? bounds.bottom - 45) + Math.sin(i * Math.PI / 2) * 30, ease(time / 3))
        : blend(capture.y, shipY + Math.sin(angle) * radius, gather);
      const shrink = blend(1, .65, ease(time / 1.7));
      const appearance = appearances[i];
      Object.assign(satellite, { x: x * scale, y: y * scale, size: capture.size * scale * shrink,
        envelopeScale: blend(1, .45, ease(time / 1.7)),
        appearance: { ...appearance, pose: { ...appearance.pose,
          translateX: appearance.pose.translateX * shrink } } });
    });
    // Snap only the displayed top-left after the hull offset and world scale.
    // Physics, satellites and collision continue to retain fractional positions.
    const pixelsPerUnit = (window.devicePixelRatio || 1) * scale;
    ship.x = Math.round((shipX - shipAppearance.width / 2) * pixelsPerUnit) / pixelsPerUnit * scale;
    ship.y = Math.round((shipY - shipAppearance.height * 5 / 12) * pixelsPerUnit) / pixelsPerUnit * scale;
    ship.opacity = ease((time - 1.25) / .55);
  }
  function returning(progress, startTime, orbitTime, bounds, center, targets) {
    // Reverse the same gathering curve while unwinding the current battle orbit.
    const remaining = 1 - ease(progress);
    captures.forEach((capture, i) => {
      const { appearance, ...geometry } = targets[i];
      Object.assign(capture, geometry);
      appearances[i] = returningOrbAppearance(capture.appearance, appearance, ease(progress));
    });
    const time = startTime * remaining;
    const cx = (bounds.left + bounds.right) / 2;
    const cy = Math.max(bounds.top + 62, (bounds.bottom + 20) * .44);
    const y = blend(cy, bounds.bottom - 45, ease((time - 1.8) / 1.2));
    render(time, orbitTime * remaining, bounds, center ? {
      x: blend(cx, center.x, remaining), y: blend(y, center.y, remaining),
    } : undefined);
    ship.opacity = (1 - ease(progress / .4)) * ease((startTime - 1.25) / .55);
  }
  return { render, returning, remove() { disposed = true; layer.dispose(); } };
}

// Own the complete visual handoff; the game supplies time, its arena and formation.
// No independent animation loop or completion callback can outlive disposal.
export function mountGamePerformance({ presentation, reduced, scale = 1, onFrame, effects }) {
  const captures = presentation.satellites;
  const artwork = mountArtwork(presentation.graphics, captures, reduced, scale, onFrame, effects);
  let phase = 'opening', elapsed = 0, formation, returnElapsed = 0, disposed = false;
  return {
    advance(dt, bounds, battle) {
      if (disposed) return 'disposed';
      if (phase === 'returning') {
        returnElapsed += dt;
        const progress = Math.min(1, returnElapsed / (reduced ? .25 : 1.5));
        artwork.returning(progress, elapsed, (formation?.seconds ?? 0) % 6, bounds, formation?.ship, presentation.returnTargets());
        if (progress === 1) phase = 'returned';
      } else if (phase !== 'returned') {
        if (battle) {
          elapsed = 3;
          formation = { seconds: battle.seconds, ship: { ...battle.ship } };
        } else elapsed = Math.min(3, elapsed + dt);
        artwork.render(elapsed, formation?.seconds ?? 0, bounds, formation?.ship, dt);
        if (elapsed === 3) phase = 'ready';
      }
      return phase;
    },
    returnHome() {
      if (disposed || phase === 'returning' || phase === 'returned') return;
      phase = 'returning'; returnElapsed = 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      artwork.remove(); presentation.dispose();
    },
  };
}
