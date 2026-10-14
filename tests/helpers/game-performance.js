// These functions are also serialized into the real production page by the manual runner.
export function performanceRandom(measuring) {
  let fastRolls = 0;
  return purpose => purpose === 'fast' && measuring() && ++fastRolls % 7 === 0 ? .1 : .5;
}

export const productionGameBundle = /\/assets\/space-game-[^/]+\.js(?:\?.*)?$/;
export function observeProductionBattle(source) {
  const signature = source.match(/function ([A-Za-z_$][\w$]*)\(\{bounds:[\w$]+,random:[\w$]+=Math\.random,reducedMotion:[\w$]+=!1\}\)/);
  if (!signature) throw new Error('Built battle constructor signature changed: update read-only observer');
  const name = signature[1];
  return source.replace(signature[0], signature[0].replace(`function ${name}(`, 'function observedCreateBattle(')) + `
function ${name}(options) {
  const random = (${performanceRandom.toString()})(() => window.measureMode);
  const battle = observedCreateBattle({...options, random});
  Object.defineProperty(window, 'battleSnapshot', {configurable: true, get: () => JSON.parse(JSON.stringify(battle.state))});
  return battle;
}`;
}

export function hardwareProblems(renderer, gpu) {
  const problems = [];
  if (!renderer || /swiftshader|llvmpipe|software/i.test(renderer)) problems.push('hardware WebGL renderer missing');
  if (gpu?.featureStatus?.gpu_compositing !== 'enabled') problems.push('GPU compositing disabled');
  return problems;
}

export function workloadProblems(m, { final = false } = {}) {
  const problems = [];
  if (m.interrupted) problems.push('page hidden, unfocused or modal open');
  if (m.ended) problems.push('battle ended');
  if (!m.attributesValid) problems.push('maximum growth attributes missing');
  if (!m.fullForwardCohort) problems.push('no observed 24-shot piercing volley');
  if (!m.fast || !m.ordinary || !m.coexisting) problems.push('fast and ordinary obstacles not observed together');
  if (!(m.shipDistance > 100)) problems.push('ship movement not demonstrated');
  if (!(m.backgroundDraws >= (final ? 1000 : 10))) problems.push('background not advancing');
  if (final && (!m.done || !(m.seconds >= 179.5))) problems.push('180-second measurement incomplete');
  return problems;
}

export function startObservation(durationMs) {
  const m = window.measurement = {
    start: performance.now(), intervals: [], interrupted: false, backgroundStart: window.backgroundDraws,
    fast: 0, ordinary: 0, coexisting: false, fullForwardCohort: false, maxBullets: 0, shipDistance: 0,
  };
  let previous, previousShip;
  function frame(now) {
    if (previous !== undefined) m.intervals.push(now - previous);
    previous = now;
    const s = window.battleSnapshot;
    if (s) {
      const fast = s.obstacles.filter(o => o.fast).length;
      const ordinary = s.obstacles.length - fast;
      m.fast += fast; m.ordinary += ordinary; m.coexisting ||= fast > 0 && ordinary > 0;
      m.maxBullets = Math.max(m.maxBullets, s.bullets.length);
      m.ended ||= s.ended;
      if (previousShip) m.shipDistance += Math.hypot(s.ship.x - previousShip.x, s.ship.y - previousShip.y);
      previousShip = s.ship;
      m.attributesValid = (m.attributesValid ?? true) && s.trajectoryCount === 24 && s.fireInterval === .11 && s.piercing && s.ship.movementSpeed === 690;
      const cohorts = new Map();
      for (const b of s.bullets.filter(b => b.piercing)) {
        const life = b.life.toFixed(6);
        cohorts.set(life, (cohorts.get(life) || 0) + 1);
      }
      m.fullForwardCohort ||= [...cohorts.values()].includes(24);
    }
    if (document.hidden || !document.hasFocus() || document.querySelector('.game-modal[open]')) {
      m.interrupted = true;
      m.reason = { hidden: document.hidden, focus: document.hasFocus(), ended: s?.ended };
    }
    if (now - m.start < durationMs) requestAnimationFrame(frame);
    else m.done = true;
  }
  requestAnimationFrame(frame);
}

export function readObservation() {
  const m = window.measurement;
  const sorted = [...m.intervals].sort((a, b) => a - b);
  const seconds = m.intervals.reduce((a, b) => a + b, 0) / 1000;
  return { ...m, intervals: undefined, seconds, fps: seconds ? m.intervals.length / seconds : 0,
    within25ms: m.intervals.filter(n => n <= 25).length / m.intervals.length,
    p95ms: sorted[Math.floor(sorted.length * .95)], p99ms: sorted[Math.floor(sorted.length * .99)],
    backgroundDraws: window.backgroundDraws - m.backgroundStart };
}
