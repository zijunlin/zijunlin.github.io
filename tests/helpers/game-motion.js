// Measurement tooling only: production code exposes no performance controls.
export function observeMotionBattle(source) {
  const signature = source.match(/function ([A-Za-z_$][\w$]*)\(\{bounds:[\w$]+,random:[\w$]+=Math\.random,reducedMotion:[\w$]+=!1\}\)/);
  if (!signature) throw new Error('Built battle constructor signature changed: update motion observer');
  const name = signature[1];
  return source.replace(signature[0], signature[0].replace(`function ${name}(`, 'function motionOriginalBattle(')) + `
function ${name}(options) {
  let bounds = {...options.bounds}, paused = false;
  // Ordinary slow obstacles enter from the upper left. All rules still run;
  // each ten-second sample starts a fresh run via the real replay button.
  const values = {type: .9, side: 0, position: 0, heading: .5, speed: 0, fast: .5};
  const battle = motionOriginalBattle({...options, random: purpose => values[purpose]});
  const pause = battle.setPaused, resize = battle.resize;
  battle.setPaused = value => { paused = value; return pause(value); };
  battle.resize = value => { bounds = {...value}; return resize(value); };
  Object.defineProperty(window, 'motionState', {configurable: true, get: () => ({
    x: battle.state.ship.x, y: battle.state.ship.y, speed: battle.state.ship.movementSpeed,
    seconds: battle.state.seconds, ended: battle.state.ended, paused, bounds: {...bounds},
    obstacles: battle.state.obstacles.length, bullets: battle.state.bullets.length,
    trajectoryCount: battle.state.trajectoryCount, fireInterval: battle.state.fireInterval
  })});
  return battle;
}`;
}

// Low-overhead browser graphics boundary adapter for the native renderer. It
// records the uniforms used by the actual sharp hull draw, never battle state.
export function observeMotionDrawing() {
  const api = WebGLRenderingContext.prototype;
  const locations = new WeakMap(), states = new WeakMap(), active = new WeakMap();
  const state = program => {
    if (!states.has(program)) states.set(program, {});
    return states.get(program);
  };
  const get = api.getUniformLocation, one = api.uniform1f, two = api.uniform2f;
  const use = api.useProgram, draw = api.drawArrays;
  api.getUniformLocation = function (program, name) {
    const result = get.call(this, program, name);
    if (result && ['shipOrigin', 'worldScale', 'opacity', 'mask'].includes(name)) locations.set(result, { state: state(program), name });
    return result;
  };
  api.uniform1f = function (location, value) {
    const uniform = location && locations.get(location);
    if (uniform) uniform.state[uniform.name] = value;
    return one.call(this, location, value);
  };
  api.uniform2f = function (location, x, y) {
    const uniform = location && locations.get(location);
    if (uniform?.name === 'shipOrigin') { uniform.state.x = x; uniform.state.y = y; }
    return two.call(this, location, x, y);
  };
  api.useProgram = function (program) { active.set(this, program); return use.call(this, program); };
  window.motionDrawing = null;
  api.drawArrays = function (mode, first, count) {
    const result = draw.call(this, mode, first, count), submitted = states.get(active.get(this));
    if (submitted?.mask === 0 && submitted.opacity > 0) {
      if (!window.motionDrawing) window.motionDrawing = {};
      Object.assign(window.motionDrawing, { x: submitted.x, y: submitted.y, scale: submitted.worldScale });
    }
    return result;
  };
}

// Serialized into the browser by the runner; reads a visible renderer and a
// narrow read-only battle snapshot. No clock replacement, screenshots or logs.
export function collectMotion({ durationMs }) {
  return new Promise(resolve => {
    if (!window.motionDrawing) throw new Error('Native ship draw observer unavailable; update the renderer adapter');
    const scale = window.motionDrawing.scale;
    const frames = [], events = [], keys = new Set();
    const controller = new AbortController(), { signal } = controller;
    const input = () => ({ x: Number(keys.has('arrowright')) - Number(keys.has('arrowleft')),
      y: Number(keys.has('arrowdown')) - Number(keys.has('arrowup')) });
    for (const type of ['keydown', 'keyup']) window.addEventListener(type, event => {
      if (!event.key.toLowerCase().startsWith('arrow')) return;
      if (type === 'keydown') keys.add(event.key.toLowerCase()); else keys.delete(event.key.toLowerCase());
      events.push({ at: performance.now(), type, key: event.key });
    }, { signal, capture: true });
    for (const type of ['blur', 'focus']) window.addEventListener(type, () => {
      events.push({ at: performance.now(), type });
      if (type === 'blur') keys.clear();
    }, { signal });
    document.addEventListener('visibilitychange', () => events.push({ at: performance.now(), type: 'visibility', hidden: document.hidden }), { signal });
    let previous, began;
    function frame(now) {
      const started = performance.now(), state = window.motionState;
      if (!state) { controller.abort(); resolve({ frames, events, error: 'Battle observer missing' }); return; }
      const display = window.motionDrawing, direction = input();
      const row = { now, x: state.x, y: state.y, displayX: display.x, displayY: display.y,
        inputX: direction.x, inputY: direction.y, paused: state.paused,
        focused: document.hasFocus(), hidden: document.hidden, ended: state.ended,
        seconds: state.seconds, speed: state.speed, obstacles: state.obstacles, bullets: state.bullets,
        boundary: (direction.x < 0 && state.x <= state.bounds.left + 13.21)
          || (direction.x > 0 && state.x >= state.bounds.right - 13.21)
          || (direction.y < 0 && state.y <= state.bounds.top + 16.51)
          || (direction.y > 0 && state.y >= state.bounds.bottom - 23.11) };
      if (began === undefined) { began = now; performance.mark('motion-sample-start'); }
      if (previous) {
        Object.assign(row, { dt: now - previous.now, dx: row.x - previous.x, dy: row.y - previous.y,
          displayDx: row.displayX - previous.displayX, displayDy: row.displayY - previous.displayY,
          sampleCostMs: performance.now() - started });
        frames.push(row);
      }
      previous = row;
      if (now - began >= durationMs || state.ended) {
        performance.mark('motion-sample-end');
        controller.abort(); resolve({ frames, events, scale, bounds: state.bounds, durationMs: now - began,
          displayObservation: 'Actual WebGL sharp-hull draw uniforms in viewport CSS pixels; no simulation-derived display coordinates, readbacks or per-frame layout flush',
          initialSpeed: frames[0]?.speed, finalSpeed: state.speed, ended: state.ended });
      } else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

export function summarizePresentation(events) {
  const start = events.find(e => e.name === 'motion-sample-start')?.ts;
  const end = events.find(e => e.name === 'motion-sample-end')?.ts;
  if (start === undefined || end === undefined) return { available: false, reason: 'Sample timing markers absent from trace' };
  const selected = events.filter(e => e.ts >= start && e.ts <= end);
  const dropped = selected.filter(e => e.name === 'DroppedFrame');
  return { available: true, start, end,
    droppedFrames: new Set(dropped.map(e => `${e.pid}:${e.args?.layerTreeId}:${e.args?.frameSeqId}`)).size,
    displayedEvents: selected.filter(e => e.name === 'Display::FrameDisplayed').length,
    drawEvents: selected.filter(e => e.name === 'DrawFrame').length,
    note: 'Display event count is diagnostic, not presented FPS. DroppedFrame uses unique process/layer/frame sequence identifiers; may include partial updates.' };
}

export function summarizeMotion(frames, refreshBudgetMs) {
  const eligible = frames.filter(f => !f.paused && f.focused && !f.hidden && !f.ended && !f.boundary);
  function summary(rows) {
    const sorted = rows.map(f => f.dt).sort((a, b) => a - b);
    const seconds = rows.reduce((sum, f) => sum + f.dt, 0) / 1000;
    const changed = f => Math.hypot(f.dx, f.dy) > .00001;
    const displayed = f => Math.hypot(f.displayDx, f.displayDy) > .00001;
    const ratio = fn => rows.length ? rows.filter(fn).length / rows.length : null;
    return { frames: rows.length, seconds, rafFps: seconds ? rows.length / seconds : null,
      updateFps: seconds ? rows.filter(changed).length / seconds : null,
      displayUpdateFps: seconds ? rows.filter(displayed).length / seconds : null,
      p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? null,
      p99Ms: sorted[Math.max(0, Math.ceil(sorted.length * .99) - 1)] ?? null,
      longestMs: sorted.at(-1) ?? null, overBudgetRatio: ratio(f => f.dt > refreshBudgetMs),
      overBudgetWithHalfMsToleranceRatio: ratio(f => f.dt > refreshBudgetMs + .5),
      overOneAndHalfBudgetRatio: ratio(f => f.dt > refreshBudgetMs * 1.5),
      noPositionUpdateRatio: ratio(f => !changed(f)), noDisplayUpdateRatio: ratio(f => !displayed(f)) };
  }
  return { frames: frames.length, all: summary(frames),
    moving: summary(eligible.filter(f => f.inputX || f.inputY)),
    stationary: summary(eligible.filter(f => !f.inputX && !f.inputY)),
    classifications: { boundary: frames.filter(f => f.boundary).length, paused: frames.filter(f => f.paused).length,
      unfocused: frames.filter(f => !f.focused).length, hidden: frames.filter(f => f.hidden).length,
      ended: frames.filter(f => f.ended).length },
    screenDistance: frames.reduce((sum, f) => sum + Math.hypot(f.displayDx, f.displayDy), 0) };
}
