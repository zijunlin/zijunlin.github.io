import { createBackgroundPass } from '../background/background.js';
import { createResourceScope } from './gl-resources.js';

const owners = new WeakMap();
const MAX_PIXELS = 3840 * 2160;
const RECOVERY_TIMEOUT = 8000;

// One context, frame scheduler and lifecycle own the surface. A layer's factory
// receives this context and its own resource scope; removing it leaves the
// background and all other layers alive. The factory never creates a canvas.
export function mountSharedRenderer(canvas, state) {
  owners.get(canvas)?.dispose();
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const listeners = new Set(), layers = new Set();
  let gl, resources, background, frame = 0, status = 'ready';
  let present = true, focused = document.hasFocus(), previous = performance.now();
  let elapsed = 0, backgroundElapsed = 0;
  let maxDimension, cssWidth = 0, cssHeight = 0, ratio = 0;
  let painting = false, pendingPaint = false, recoveryTimer, recoveryDeadline;
  const backgroundOffset = { x: 0, y: 0 };
  canvas.hidden = true;
  canvas.dataset.motion = 'static';
  function release() {
    cancelAnimationFrame(frame); frame = 0;
    clearTimeout(recoveryTimer);
    lifecycle.abort();
    for (const layer of [...layers]) layer.dispose();
    resources?.dispose();
    canvas.hidden = true;
    canvas.dataset.motion = 'static';
  }
  function fail(next = 'unavailable') {
    if (status === 'unavailable' || status === 'disposed') return;
    status = next;
    release();
    for (const listener of listeners) listener(status);
  }
  const renderer = {
    get available() { return status === 'ready'; },
    get status() { return status; },
    // Recompute for the current viewport: resize listeners may run before RAF.
    get pixelRatio() { return surfaceRatio(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setBackgroundOffset(x, y) { backgroundOffset.x = x; backgroundOffset.y = y; },
    // Ownership and preference changes must not leave an old surface visible
    // until the next RAF. Repaint without advancing either scene clock.
    redraw() {
      if (status !== 'ready') return;
      try { paint(performance.now()); } catch { graphicsError(); }
    },
    addLayer(createLayer) {
      if (status !== 'ready') throw new Error('Shared graphics unavailable');
      let scope, drawing;
      const layer = {
        draw: info => drawing?.draw(info),
        release() {
          try { drawing?.dispose?.(); } finally { scope?.dispose(); drawing = undefined; scope = undefined; }
        },
        rebuild() {
          scope = createResourceScope(gl);
          drawing = createLayer(gl, scope);
          if (gl.getError() !== gl.NO_ERROR) throw new Error('Layer allocation failed');
        },
        dispose() {
          if (!layers.delete(layer)) return;
          layer.release();
        },
      };
      layers.add(layer);
      try {
        layer.rebuild();
        return { dispose: () => layer.dispose() };
      } catch (error) { layer.dispose(); graphicsError(); throw error; }
    },
    dispose() {
      if (status === 'disposed') return;
      status = 'disposed'; release(); listeners.clear();
      if (owners.get(canvas) === renderer) owners.delete(canvas);
    },
  };
  owners.set(canvas, renderer);
  function canRun() { return status === 'ready' && present && focused && !document.hidden; }
  function surfaceRatio() {
    const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
    return Math.min(devicePixelRatio || 1,
      Math.sqrt(MAX_PIXELS / (width * height)), maxDimension / width, maxDimension / height);
  }
  function resize() {
    const nextWidth = Math.max(1, innerWidth), nextHeight = Math.max(1, innerHeight);
    const nextRatio = surfaceRatio();
    if (cssWidth === nextWidth && cssHeight === nextHeight && ratio === nextRatio) return;
    cssWidth = nextWidth; cssHeight = nextHeight; ratio = nextRatio;
    canvas.width = Math.max(1, Math.floor(cssWidth * ratio));
    canvas.height = Math.max(1, Math.floor(cssHeight * ratio));
    background.resize(cssWidth, cssHeight);
    // Allocation checks only: never synchronize GPU error state during drawing.
    if (gl.getError() !== gl.NO_ERROR) throw new Error('Surface allocation failed');
  }
  function paint(now, animated = false) {
    if (painting) { pendingPaint = true; return; }
    painting = true;
    try {
      // A layer may transfer ownership during its draw. Allow one repaint of
      // that final state, without recursion or creating another RAF chain.
      for (let pass = 0; pass < 2; pass++) {
        pendingPaint = false;
        resize();
        const info = { now, elapsed, animated, cssWidth, cssHeight, width: canvas.width, height: canvas.height,
          pixelRatio: ratio };
        background.draw({ ...info, elapsed: backgroundElapsed }, backgroundOffset);
        for (const layer of layers) {
          if (status !== 'ready') break;
          layer.draw(info);
        }
        if (status !== 'ready') break;
        canvas.hidden = false;
        if (!pendingPaint) break;
      }
    } finally { painting = false; }
  }

  function draw(now) {
    frame = 0;
    if (!canRun()) return;
    try {
      const delta = Math.min(Math.max(0, now - previous) / 1000, .1);
      elapsed += delta;
      backgroundElapsed += delta * .8 * (location.hash === '#work/platform' ? .2 : 1);
      previous = now;
      paint(now, true);
      if (canRun()) frame = requestAnimationFrame(draw);
    } catch { graphicsError(); }
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0;
    previous = performance.now();
    canvas.dataset.motion = canRun() ? 'running' : 'paused';
    if (canRun()) frame = requestAnimationFrame(draw);
  }
  function graphicsError() {
    // A real loss can invalidate allocations before its DOM event is delivered.
    if (status === 'ready' && gl?.isContextLost()) beginRecovery();
    else fail();
  }
  function initializeBackground() {
    resources = createResourceScope(gl);
    maxDimension = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    background = createBackgroundPass(gl, resources, state.backgroundSeed);
    cssWidth = cssHeight = ratio = 0;
  }
  function beginRecovery(event) {
    event?.preventDefault();
    if (status !== 'ready') return;
    status = 'recovering';
    cancelAnimationFrame(frame); frame = 0;
    canvas.hidden = true; canvas.dataset.motion = 'paused';
    // Keep numerical scene state and factories; lost GPU objects are unusable.
    for (const layer of layers) layer.release();
    resources?.dispose(); resources = undefined;
    recoveryDeadline = performance.now() + RECOVERY_TIMEOUT;
    recoveryTimer = setTimeout(() => fail(), RECOVERY_TIMEOUT);
    for (const listener of listeners) listener(status);
  }
  function restore() {
    if (status !== 'recovering') return;
    if (performance.now() >= recoveryDeadline || gl.isContextLost()) { fail(); return; }
    // One reconstruction attempt per loss, always on the original context.
    try {
      initializeBackground();
      for (const layer of layers) layer.rebuild();
      clearTimeout(recoveryTimer);
      status = 'ready';
      paint(performance.now());
      for (const listener of listeners) listener(status);
      sync();
    } catch { fail(); }
  }
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('Graphics unavailable');
    document.addEventListener('visibilitychange', sync, { signal });
    window.addEventListener('blur', () => { focused = false; sync(); }, { signal });
    window.addEventListener('focus', () => { focused = true; sync(); }, { signal });
    window.addEventListener('pagehide', () => { present = false; sync(); }, { signal });
    window.addEventListener('pageshow', () => { present = true; sync(); }, { signal });
    canvas.addEventListener('webglcontextlost', beginRecovery, { signal });
    canvas.addEventListener('webglcontextrestored', restore, { signal });
    initializeBackground();
    paint(performance.now());
    sync();
  } catch { graphicsError(); }
  return renderer;
}
