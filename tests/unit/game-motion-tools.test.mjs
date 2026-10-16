import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMotion, summarizePresentation } from '../helpers/game-motion.js';

test('motion report retains a long frozen frame under input and separates boundary and interrupted frames', () => {
  const sample = (dt, dx, flags = {}) => ({ dt, dx, dy: 0, displayDx: dx, displayDy: 0,
    inputX: 1, inputY: 0, paused: false, focused: true, hidden: false, ended: false, boundary: false, ...flags });
  const frames = [sample(16, 6), sample(16, 6), sample(50, 0), sample(16, 6),
    sample(16, 0, { boundary: true }), sample(100, 0, { paused: true }), sample(200, 0, { focused: false })];
  const report = summarizeMotion(frames, 1000 / 60);
  assert.equal(report.frames, 7);
  assert.equal(report.moving.frames, 4);
  assert.equal(report.moving.seconds, .098);
  assert.equal(report.moving.longestMs, 50);
  assert.equal(report.moving.p95Ms, 50);
  assert.equal(report.moving.p99Ms, 50);
  assert.equal(report.moving.noPositionUpdateRatio, .25);
  assert.equal(report.moving.noDisplayUpdateRatio, .25);
  assert.equal(report.moving.overBudgetRatio, .25);
  assert.equal(report.moving.updateFps, 3 / .098);
  assert.deepEqual(report.classifications, { boundary: 1, paused: 1, unfocused: 1, hidden: 0, ended: 0 });
  assert.equal(report.screenDistance, 18);
});

test('presentation cross-check counts frame identities inside sample markers only', () => {
  const events = [
    { name: 'DroppedFrame', ts: 5, pid: 1, args: { frameSeqId: 1, layerTreeId: 2 } },
    { name: 'motion-sample-start', ts: 10 },
    { name: 'Display::FrameDisplayed', ts: 20 },
    { name: 'DroppedFrame', ts: 25, pid: 1, args: { frameSeqId: 3, layerTreeId: 2 } },
    { name: 'DroppedFrame', ts: 26, pid: 1, args: { frameSeqId: 3, layerTreeId: 2 } },
    { name: 'DrawFrame', ts: 27 },
    { name: 'motion-sample-end', ts: 30 },
  ];
  const report = summarizePresentation(events);
  assert.equal(report.available, true);
  assert.equal(report.displayedEvents, 1);
  assert.equal(report.droppedFrames, 1);
  assert.equal(report.drawEvents, 1);
  assert.equal(summarizePresentation([]).available, false);
});
