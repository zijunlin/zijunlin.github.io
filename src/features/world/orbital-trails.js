const SAMPLES = 2048;
export const TRAIL_FRACTIONS = [.15, .4, .65, .9];

// Measure screen-space arc length, not elapsed time: Keplerian speed is variable.
export function createTrailMetric(positionAt, period, scaleX, scaleY) {
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => positionAt(period * i / SAMPLES));
  const lengths = [0];
  for (let i = 1; i <= SAMPLES; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(
      (points[i][0] - points[i - 1][0]) * scaleX,
      (points[i][1] - points[i - 1][1]) * scaleY,
    ));
  }
  const circumference = lengths[SAMPLES];
  function distanceAtTime(elapsed) {
    const turns = elapsed / period;
    const sample = (turns - Math.floor(turns)) * SAMPLES;
    const index = Math.min(Math.floor(sample), SAMPLES - 1);
    return Math.floor(turns) * circumference + lengths[index]
      + (lengths[index + 1] - lengths[index]) * (sample - index);
  }
  function pointAtDistance(distance, point = []) {
    const wrapped = ((distance % circumference) + circumference) % circumference;
    let low = 0, high = SAMPLES;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (lengths[mid] <= wrapped) low = mid;
      else high = mid;
    }
    const fraction = (wrapped - lengths[low]) / (lengths[high] - lengths[low]);
    for (let axis = 0; axis < 2; axis++) point[axis] = points[low][axis] + (points[high][axis] - points[low][axis]) * fraction;
    return point;
  }
  return { circumference, distanceAtTime, pointAtDistance };
}

export function trailSegments(metric, elapsed, fraction, count = 128, segments = []) {
  const head = metric.distanceAtTime(elapsed);
  // At startup, only reveal the part the circle has actually travelled.
  const length = Math.min(head, metric.circumference * fraction);
  let start = metric.pointAtDistance(head, segments[0]?.start);
  for (let i = 0; i < count; i++) {
    const segment = segments[i] ??= {};
    segment.end = metric.pointAtDistance(head - length * (i + 1) / count, segment.end);
    segment.start = start;
    segment.opacity = .15 * (1 - i / (count - 1));
    start = segment.end;
  }
  segments.length = count;
  return segments;
}
