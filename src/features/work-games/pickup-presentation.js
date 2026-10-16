import { projectileProfiles } from './projectiles.js';

// Presentation is separate from ability calculation. One entry owns each
// pickup's marker and bilingual feedback, including capped outcomes.
export const pickupPresentation = {
  trajectory: {
    feedback: (result, text) => text(`飞船弹道数 +1 · 当前 ${result.value} 条`, `Ship trajectories +1 · Now ${result.value}`),
    draw(painter, x, y, size) {
      const points = [[x, y - size], [x + size, y], [x, y + size], [x - size, y]];
      painter.fill(points, '#123d32'); painter.stroke(points, '#78f4c4', 2, true);
      painter.stroke([[x - 3, y + 2], [x, y - 3], [x + 3, y + 2]], '#78f4c4', 2);
    },
  },
  fireRate: {
    feedback: (_, text) => text('飞船射速提升', 'Ship fire rate increased'),
    draw(painter, x, y, size) {
      const points = [[.3, -1], [-.7, .1], [0, .1], [-.3, 1], [.7, -.1], [0, -.1]].map(([dx, dy]) => [x + dx * size, y + dy * size]);
      painter.fill(points, '#123348'); painter.stroke(points, '#6fcfff', 2, true);
    },
  },
  movement: {
    feedback: (_, text) => text('飞船移动速度提升', 'Ship movement speed increased'),
    draw(painter, x, y, size) {
      for (const offset of [-size * .4, size * .4]) painter.stroke([[x - size * .7, y + offset + size * .4], [x, y + offset - size * .4], [x + size * .7, y + offset + size * .4]], '#ffe178', 2);
    },
  },
  piercing: {
    feedback: (_, text) => text(`穿透能力提升 · 可命中 ${projectileProfiles.piercing.maxHits} 个目标`, `Piercing increased · Hits ${projectileProfiles.piercing.maxHits} targets`),
    draw(painter, x, y, size) {
      painter.stroke([[x, y + size], [x, y - size]], '#d2a7ff', 2);
      painter.stroke([[x - size * .6, y - size * .4], [x, y - size], [x + size * .6, y - size * .4]], '#d2a7ff', 2);
      painter.stroke([[x - size, y + size * .3], [x + size, y + size * .3]], '#d2a7ff', 2);
    },
  },
  shockwave: {
    feedback: (_, text) => text('冲击波 +1', 'Shockwave +1'),
    fullFeedback: (_, text) => text('冲击波储备已满', 'Shockwave reserve full'),
    draw(painter, x, y, size) {
      painter.circle(x, y, size, '#493018'); painter.circle(x, y, size, '#ffbb66', 2);
      painter.circle(x, y, size * .45, '#ffbb66', 2);
    },
  },
};
function presentation(kind) {
  if (!Object.hasOwn(pickupPresentation, kind)) throw new Error(`Missing pickup presentation: ${kind}`);
  return pickupPresentation[kind];
}
export function drawPickupMarker(painter, kind, x, y, size) {
  presentation(kind).draw(painter, x, y, size);
}
export function describePickup(result, text) {
  const entry = presentation(result.kind);
  if (!result.full) return entry.feedback(result, text);
  if (entry.fullFeedback) return entry.fullFeedback(result, text);
  return text(`已满级，+${result.points} 分`, `At maximum, +${result.points} points`);
}
