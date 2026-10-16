import { localize } from '../../i18n/index.js';
import { mountWorldParallax } from './world-parallax.js';
import { readingRoute } from '../../navigation/content-route.js';
import { createTrailMetric, trailSegments, TRAIL_FRACTIONS } from './orbital-trails.js';
import { createOrbAppearance } from '../scene/orb-scene.js';
import { createOrbMotion } from '../scene/orb-motion.js';
import { createOrbLayer } from '../scene/orb-layer.js';
import { createTrailLayer } from '../scene/trail-layer.js';

const gates = [
  { id: 'about', name: '关于我', subtitle: 'IDENTITY' },
  { id: 'career', name: '职业历程', subtitle: 'CHRONICLE' },
  { id: 'work', name: '作品集', subtitle: 'CREATION' },
  { id: 'notes', name: '随笔', subtitle: 'THOUGHTS' },
];

// A shared focus and Kepler's period ratio give the composition a planetary rhythm.
const orbits = [76, 128, 180, 232].map((radius, index) => ({
  radius, eccentricity: .3, phase: [-2.3, .6, 2.4, -.7][index],
  period: 100 * (radius / 76) ** 1.5,
}));
function position(index, layout, elapsed = 0) {
  const { radius, eccentricity, phase, period } = orbits[index];
  const mean = phase + (layout === 'B' ? .4 : 0) + elapsed / period * Math.PI * 2;
  let eccentric = mean;
  for (let i = 0; i < 5; i++) {
    eccentric -= (eccentric - eccentricity * Math.sin(eccentric) - mean) / (1 - eccentricity * Math.cos(eccentric));
  }
  return [320 + radius * (Math.cos(eccentric) - eccentricity),
    218 + radius * Math.sqrt(1 - eccentricity ** 2) * Math.sin(eccentric) * .5];
}

// Semantic links and native graphics consume the same orbital geometry.
export async function mountWorldView(container, state, graphics) {
  const area = document.createElement('section');
  area.className = 'world-area celestial-area';
  area.setAttribute('aria-label', `星辰圆点 · ${state.layout === 'A' ? '环绕核心' : '成长路径'}`);
  const stage = document.createElement('div');
  stage.className = 'world-stage celestial-stage';
  area.append(stage);
  container.append(area);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const appearances = gates.map((_, i) => createOrbAppearance(i));
  const artwork = appearances.map(appearance => createOrbMotion(appearance, { reduced: reducedMotion.matches }));
  const links = gates.map((gate, i) => {
    const link = document.createElement('a');
    link.className = `celestial-gate${gate.id === 'work' ? ' celestial-featured' : ''}`;
    link.href = `#${gate.id}`;
    link.setAttribute('aria-label', gate.name);
    const point = position(i, state.layout);
    link.style.cssText = `left:${point[0] / 640 * 100}%;top:${point[1] / 440 * 100}%;--orb-color:#a2d9df`;
    link.innerHTML = `<span class="orb-caption"><small>${gate.subtitle}</small><span>${gate.name}</span></span>`;
    stage.append(link);
    return link;
  });
  localize(area);
  const parallax = mountWorldParallax(stage, graphics);
  const controller = new AbortController();
  const { signal } = controller;
  let present = true, hovered = false, focused = false, active = document.hasFocus();
  let paused = true;
  let elapsed = 0, previous, taken = false, savedElapsed = 0;
  let trailMetrics = [], lastTrailElapsed;
  function measureTrails() {
    lastTrailElapsed = undefined;
    trailMetrics = orbits.map(({ period }, i) => createTrailMetric(
      time => position(i, state.layout, time), period, stage.clientWidth / 640, stage.clientHeight / 440,
    ));
  }
  const resizeObserver = new ResizeObserver(() => { measureTrails(); graphics.redraw(); });
  resizeObserver.observe(stage);
  measureTrails();
  function geometry(i) {
    // The link owns the responsive hit area. Its viewport box includes the same
    // stage parallax and entrance translation as its label and the native trail.
    const box = links[i].getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, size: box.width };
  }
  let layer;
  try {
    layer = graphics.addLayer((gl, resources) => {
      let orbs = [], bounds, opacity = 0;
      const tracks = orbits.map(() => []);
      lastTrailElapsed = undefined;
      const trails = createTrailLayer(gl, resources, () => ({ tracks, orbs, bounds, opacity, elapsed }));
      const circles = createOrbLayer(gl, resources, () => orbs);
      return { draw(info) {
        const dt = previous === undefined ? 0 : Math.min(Math.max(0, info.elapsed - previous), .1);
        previous = info.elapsed;
        if (!taken) artwork.forEach(art => art.advance(dt * 1000));
        if (!paused) {
          elapsed += dt;
          links.forEach((link, i) => {
            const [x, y] = position(i, state.layout, elapsed);
            link.style.left = `${x / 640 * 100}%`;
            link.style.top = `${y / 440 * 100}%`;
          });
        }
        if (taken || container.hidden) return;
        opacity = Number(getComputedStyle(container).opacity);
        bounds = stage.getBoundingClientRect();
        orbs = links.map((link, i) => ({ ...geometry(i), opacity, appearance: artwork[i].snapshot(),
          priority: link.matches(':hover, :focus-visible') ? 1 : 0 })).sort((a, b) => a.priority - b.priority);
        if (elapsed !== lastTrailElapsed) {
          trailMetrics.forEach((metric, i) => trailSegments(metric, elapsed, TRAIL_FRACTIONS[i], 128, tracks[i]));
          lastTrailElapsed = elapsed;
        }
        // Geometry, numerical cutouts and artwork all describe this same frame.
        trails.draw(info);
        circles.draw(info);
      } };
    });
  } catch (error) {
    controller.abort(); resizeObserver.disconnect(); parallax.dispose(); area.remove();
    throw error;
  }

  function sync() {
    const selected = readingRoute().slice(1);
    const preview = Boolean(selected);
    stage.classList.toggle('celestial-paused', document.hidden || !present || !active || preview || taken);
    artwork.forEach((art, i) => {
      if (!taken) art.setExpanded(links[i].matches(':hover, :focus-visible'));
      art.setPaused(document.hidden || !present || !active || preview || taken);
    });
    links.forEach((link, i) => link.classList.toggle('is-active', gates[i].id === selected));
    paused = document.hidden || !present || !active || preview || taken || hovered || focused || reducedMotion.matches;
  }
  const cancelGestures = [];
  links.forEach((link, i) => {
    let gesture, suppressClick = false;
    cancelGestures.push(() => {
      const id = gesture?.id;
      if (gesture) suppressClick = true;
      gesture = null;
      if (id !== undefined && link.hasPointerCapture(id)) link.releasePointerCapture(id);
    });
    // Native link dragging cancels pointer capture before the visitor releases.
    link.addEventListener('dragstart', event => event.preventDefault(), { signal });
    link.addEventListener('pointerdown', event => {
      if (!graphics.available || !event.isPrimary || event.button !== 0) return;
      suppressClick = false;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
      link.setPointerCapture(event.pointerId);
      artwork[i].press();
    }, { signal });
    link.addEventListener('pointermove', event => {
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) suppressClick = true;
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) link.addEventListener(type, event => {
      if (gesture?.id !== event.pointerId) return;
      if (type === 'pointercancel') suppressClick = true;
      gesture = null;
      if (event.pointerType !== 'mouse' && document.activeElement === link) link.blur();
    }, { signal });
    link.addEventListener('click', event => {
      if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
      suppressClick = false;
    }, { signal, capture: true });
    link.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovered = true; sync(); }, { signal });
    link.addEventListener('pointerleave', () => { hovered = false; sync(); }, { signal });
  });
  const unsubscribeGraphics = graphics.subscribe(status => {
    if (status === 'recovering') cancelGestures.forEach(cancel => cancel());
  });
  stage.addEventListener('focusin', () => { focused = links.some(link => link.matches(':focus-visible')); sync(); }, { signal });
  stage.addEventListener('focusout', event => { focused = Boolean(event.relatedTarget?.matches(':focus-visible') && stage.contains(event.relatedTarget)); sync(); }, { signal });
  reducedMotion.addEventListener('change', () => { artwork.forEach(art => art.setReducedMotion(reducedMotion.matches)); sync(); graphics.redraw(); }, { signal });
  window.addEventListener('blur', () => { active = false; sync(); }, { signal });
  window.addEventListener('focus', () => { active = true; previous = undefined; sync(); }, { signal });
  container.addEventListener('animationend', event => { if (event.animationName === 'world-arrive') graphics.redraw(); }, { signal });
  window.addEventListener('hashchange', sync, { signal });
  document.addEventListener('visibilitychange', sync, { signal });
  window.addEventListener('pagehide', () => { present = false; sync(); }, { signal });
  window.addEventListener('pageshow', () => { present = true; sync(); }, { signal });
  sync();
  return {
    takeOver() {
      savedElapsed = elapsed;
      taken = true;
      // Capture interaction geometry and numerical appearance before focus or
      // visibility changes. The game renders these values in the shared context.
      const captures = links.map((link, i) => {
        const bounds = link.getBoundingClientRect();
        return { id: gates[i].id, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
          size: bounds.width, appearance: artwork[i].snapshot() };
      });
      parallax.suspend(true);
      links.forEach(link => {
        link.style.visibility = 'hidden';
        link.inert = true;
      });
      sync(); graphics.redraw();
      return captures;
    },
    returnTargets() {
      return links.map((link, i) => {
        const box = link.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, size: box.width, appearance: artwork[i].returnAppearance() };
      });
    },
    restore() {
      if (!taken) return;
      taken = false;
      elapsed = savedElapsed;
      previous = undefined;
      links.forEach((link, i) => {
        const [x, y] = position(i, state.layout, elapsed);
        link.style.left = `${x / 640 * 100}%`;
        link.style.top = `${y / 440 * 100}%`;
        link.style.visibility = '';
        link.inert = false;
        artwork[i].setExpanded(false, true);
      });
      parallax.suspend(false);
      sync(); graphics.redraw();
    },
    dispose() {
      unsubscribeGraphics(); controller.abort(); layer.dispose(); resizeObserver.disconnect(); parallax.dispose(); area.remove();
    },
  };
}
