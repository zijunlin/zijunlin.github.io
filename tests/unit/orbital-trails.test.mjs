import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrailMetric, trailSegments, TRAIL_FRACTIONS } from '../../src/features/world/orbital-trails.js';

function metricFor(scaleX, scaleY) {
  return createTrailMetric(time => {
    const mean = time / 100 * Math.PI * 2;
    let angle = mean;
    for (let i = 0; i < 5; i++) angle -= (angle - .3 * Math.sin(angle) - mean) / (1 - .3 * Math.cos(angle));
    return [232 * Math.cos(angle), 110 * Math.sin(angle)];
  }, 100, scaleX, scaleY);
}

test('trail lengths follow screen-space circumference across sizes and orbital phases', () => {
  for (const [sx, sy] of [[1.8, 1.3], [.55, 1.4]]) {
    const metric = metricFor(sx, sy);
    for (const elapsed of [101, 125, 175, 1000]) {
      for (const fraction of TRAIL_FRACTIONS) {
        const segments = trailSegments(metric, elapsed, fraction);
        const length = segments.reduce((sum, { start, end }) => sum + Math.hypot((end[0] - start[0]) * sx, (end[1] - start[1]) * sy), 0);
        assert.ok(Math.abs(length / metric.circumference - fraction) < .001);
        assert.equal(segments[0].opacity, .15);
        assert.equal(segments.at(-1).opacity, 0);
        assert.ok(segments.every((s, i) => !i || s.opacity < segments[i - 1].opacity));
        assert.deepEqual(segments[0].start, metric.pointAtDistance(metric.distanceAtTime(elapsed)));
      }
    }
  }
});

test('startup draws only travelled track and looping never accumulates a full orbit', () => {
  const metric = metricFor(1, 1);
  const initial = trailSegments(metric, 0, .9);
  assert.ok(initial.every(s => s.start[0] === s.end[0] && s.start[1] === s.end[1]));
  const growing = trailSegments(metric, 1, .9);
  assert.ok(Math.hypot(...growing.at(-1).end.map((v, i) => v - metric.pointAtDistance(0)[i])) < .0001);
  const mature = trailSegments(metric, 500, .15);
  assert.notDeepEqual(mature[0].start, mature.at(-1).end);
});
