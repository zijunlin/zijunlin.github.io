import { projectileProfiles } from './projectiles.js';

// Presentation is separate from ability calculation. One entry owns each
// pickup's marker and bilingual feedback, including capped outcomes.
export const pickupPresentation = {
  trajectory: {
    feedback: (result, text) => text(`飞船弹道数 +1 · 当前 ${result.value} 条`, `Ship trajectories +1 · Now ${result.value}`),
    draw(context, x, y, size) {
      context.strokeStyle = '#78f4c4'; context.fillStyle = '#123d32'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x, y - size); context.lineTo(x + size, y);
      context.lineTo(x, y + size); context.lineTo(x - size, y); context.closePath(); context.fill(); context.stroke();
      context.beginPath(); context.moveTo(x - 3, y + 2); context.lineTo(x, y - 3); context.lineTo(x + 3, y + 2); context.stroke();
    },
  },
  fireRate: {
    feedback: (_, text) => text('飞船射速提升', 'Ship fire rate increased'),
    draw(context, x, y, size) {
      context.strokeStyle = '#6fcfff'; context.fillStyle = '#123348'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x + size * .3, y - size);
      context.lineTo(x - size * .7, y + size * .1); context.lineTo(x, y + size * .1);
      context.lineTo(x - size * .3, y + size); context.lineTo(x + size * .7, y - size * .1);
      context.lineTo(x, y - size * .1); context.closePath(); context.fill(); context.stroke();
    },
  },
  movement: {
    feedback: (_, text) => text('飞船移动速度提升', 'Ship movement speed increased'),
    draw(context, x, y, size) {
      context.strokeStyle = '#ffe178'; context.lineWidth = 2;
      for (const offset of [-size * .4, size * .4]) {
        context.beginPath(); context.moveTo(x - size * .7, y + offset + size * .4);
        context.lineTo(x, y + offset - size * .4); context.lineTo(x + size * .7, y + offset + size * .4); context.stroke();
      }
    },
  },
  piercing: {
    feedback: (_, text) => text(`穿透能力提升 · 可命中 ${projectileProfiles.piercing.maxHits} 个目标`, `Piercing increased · Hits ${projectileProfiles.piercing.maxHits} targets`),
    draw(context, x, y, size) {
      context.strokeStyle = '#d2a7ff'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x, y + size); context.lineTo(x, y - size);
      context.moveTo(x - size * .6, y - size * .4); context.lineTo(x, y - size); context.lineTo(x + size * .6, y - size * .4);
      context.moveTo(x - size, y + size * .3); context.lineTo(x + size, y + size * .3); context.stroke();
    },
  },
  shockwave: {
    feedback: (_, text) => text('冲击波 +1', 'Shockwave +1'),
    fullFeedback: (_, text) => text('冲击波储备已满', 'Shockwave reserve full'),
    draw(context, x, y, size) {
      context.strokeStyle = '#ffbb66'; context.fillStyle = '#493018'; context.lineWidth = 2;
      context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2); context.fill(); context.stroke();
      context.beginPath(); context.arc(x, y, size * .45, 0, Math.PI * 2); context.stroke();
    },
  },
};
function presentation(kind) {
  if (!Object.hasOwn(pickupPresentation, kind)) throw new Error(`Missing pickup presentation: ${kind}`);
  return pickupPresentation[kind];
}
export function drawPickupMarker(context, kind, x, y, size) {
  presentation(kind).draw(context, x, y, size);
}
export function describePickup(result, text) {
  const entry = presentation(result.kind);
  if (!result.full) return entry.feedback(result, text);
  if (entry.fullFeedback) return entry.fullFeedback(result, text);
  return text(`已满级，+${result.points} 分`, `At maximum, +${result.points} points`);
}
