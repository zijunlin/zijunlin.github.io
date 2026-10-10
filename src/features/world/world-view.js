import { localize } from '../../i18n/index.js';
import { mountWorldParallax } from './world-parallax.js';
import { readingRoute } from '../../navigation/content-route.js';
import { createTrailMetric, trailSegments, TRAIL_FRACTIONS } from './orbital-trails.js';

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

function circleArt(index) {
  // Eight brighter particles spiral inward; the other 28 orbit at fixed radii.
  const dust = Array.from({ length: 36 }, (_, i) => {
    // Sample uniformly by area around the disc, within the halo's smallest breath.
    // Positions are chosen once at mount, so hovering does not reshuffle particles.
    const angle = Math.random() * 360;
    const radius = Math.sqrt(38 ** 2 + Math.random() * (100 ** 2 - 38 ** 2));
    const siphons = i % 8 === 0 || i >= 32;
    const duration = siphons ? 2.8 + (i % 9) * .3 : 10 + (i % 9) * .7;
    return `<g class="orb-inflow${siphons ? '' : ' orb-circulating'}" style="--start-angle:${angle}deg;--inflow-radius:${radius}px;--inflow-duration:${duration}s;--inflow-delay:${-duration * ((i * .618034) % 1)}s">
      <circle class="${siphons ? 'orb-infall' : 'orb-satellite'}" cx="${100 + radius}" cy="100" r="${1.8 + (i % 5) * .35}"/>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <defs><radialGradient id="circle-halo-${index}"><stop stop-color="currentColor" stop-opacity="1"/><stop offset=".45" stop-color="currentColor" stop-opacity=".55"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>
    <g class="orb-halo"><g class="orb-pulse" style="--pulse-delay:${-index * 1.7}s">
      <circle cx="100" cy="100" r="125" fill="url(#circle-halo-${index})"/>
    </g></g>
    <circle class="orb-disc" cx="100" cy="100" r="35.7" fill="currentColor"/>
    <g class="orb-particles">${dust}</g>
  </svg>`;
}

// Transparent vector constellations remain crisp and usable without a 3D GPU.
export async function mountWorldView(container, state) {
  const area = document.createElement('section');
  area.className = 'world-area celestial-area';
  area.setAttribute('aria-label', `星辰圆点 · ${state.layout === 'A' ? '环绕核心' : '成长路径'}`);
  const stage = document.createElement('div');
  stage.className = 'world-stage celestial-stage';
  area.append(stage);
  container.append(area);
  const trails = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  trails.setAttribute('viewBox', '0 0 640 440');
  trails.setAttribute('preserveAspectRatio', 'none');
  trails.setAttribute('aria-hidden', 'true');
  trails.classList.add('celestial-trails');
  const maskId = `trail-disc-mask-${crypto.randomUUID()}`;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="440" style="mask-type:luminance"><rect width="640" height="440" fill="white" stroke="none"/></mask>`;
  trails.append(defs);
  const mask = defs.firstElementChild;
  const cutouts = orbits.map(() => {
    const cutout = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    cutout.classList.add('trail-disc-cutout');
    cutout.setAttribute('fill', 'black');
    cutout.setAttribute('stroke', 'none');
    mask.append(cutout);
    return cutout;
  });
  const trailPaths = orbits.map(() => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('mask', `url(#${maskId})`);
    trails.append(group);
    return Array.from({ length: 128 }, (_, segment) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-opacity', .15 * (1 - segment / 127));
      group.append(path);
      return path;
    });
  });
  stage.append(trails);
  const links = gates.map((gate, i) => {
    const link = document.createElement('a');
    link.className = `celestial-gate${gate.id === 'work' ? ' celestial-featured' : ''}`;
    link.href = `#${gate.id}`;
    link.setAttribute('aria-label', gate.name);
    const point = position(i, state.layout);
    link.style.cssText = `left:${point[0] / 640 * 100}%;top:${point[1] / 440 * 100}%;--orb-color:#a2d9df`;
    link.innerHTML = `<span class="orb-art">${circleArt(i)}</span><span class="orb-caption"><small>${gate.subtitle}</small><span>${gate.name}</span></span>`;
    stage.append(link);
    return link;
  });
  localize(area);
  const parallax = mountWorldParallax(stage, document.getElementById('shader-canvas'));
  const controller = new AbortController();
  const { signal } = controller;
  let present = true, hovered = false, focused = false;
  let frame = 0, elapsed = 0, trailElapsed = 0, previous = 0, taken = false, savedElapsed = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let trailMetrics = [];
  function drawTrails() {
    cutouts.forEach((cutout, i) => {
      const [x, y] = position(i, state.layout, elapsed);
      cutout.setAttribute('cx', x);
      cutout.setAttribute('cy', y);
    });
    trailMetrics.forEach((metric, i) => {
      trailSegments(metric, trailElapsed, TRAIL_FRACTIONS[i]).forEach(({ start, end }, segment) => {
        trailPaths[i][segment].setAttribute('d', trailElapsed > 0
          ? `M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}` : '');
      });
    });
  }
  function measureTrails() {
    cutouts.forEach((cutout, i) => {
      const radius = Number(links[i].querySelector('.orb-disc').getAttribute('r')) * links[i].clientWidth / 200;
      cutout.setAttribute('rx', radius * 640 / stage.clientWidth);
      cutout.setAttribute('ry', radius * 440 / stage.clientHeight);
    });
    trailMetrics = orbits.map(({ period }, i) => createTrailMetric(
      time => position(i, state.layout, time), period, stage.clientWidth / 640, stage.clientHeight / 440,
    ));
    drawTrails();
  }
  const resizeObserver = new ResizeObserver(measureTrails);
  resizeObserver.observe(stage);
  measureTrails();
  function animate(now) {
    frame = 0;
    if (previous) {
      const dt = Math.min((now - previous) / 1000, .1);
      if (!taken) { elapsed += dt; trailElapsed = elapsed; }
    }
    previous = now;
    if (!taken) links.forEach((link, i) => {
      const [x, y] = position(i, state.layout, elapsed);
      link.style.left = `${x / 640 * 100}%`;
      link.style.top = `${y / 440 * 100}%`;
    });
    // Hidden homepage trails share the frozen orb phase until the game returns.
    if (!taken) drawTrails();
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    cutouts.forEach((cutout, i) => cutout.classList.toggle('is-expanded', links[i].matches(':hover, :focus-visible')));
    const selected = readingRoute().slice(1);
    const preview = Boolean(selected);
    stage.classList.toggle('celestial-paused', document.hidden || !present || preview || taken);
    links.forEach((link, i) => link.classList.toggle('is-active', gates[i].id === selected));
    const paused = document.hidden || !present || preview || (!taken && (hovered || focused)) || reducedMotion.matches;
    if (paused) {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    } else if (!frame) frame = requestAnimationFrame(animate);
  }
  links.forEach(link => {
    link.addEventListener('pointerenter', () => { hovered = true; sync(); }, { signal });
    link.addEventListener('pointerleave', () => { hovered = false; sync(); }, { signal });
  });
  stage.addEventListener('focusin', () => { focused = true; sync(); }, { signal });
  stage.addEventListener('focusout', event => { focused = stage.contains(event.relatedTarget); sync(); }, { signal });
  reducedMotion.addEventListener('change', sync, { signal });
  window.addEventListener('hashchange', sync, { signal });
  document.addEventListener('visibilitychange', sync, { signal });
  window.addEventListener('pagehide', () => { present = false; sync(); }, { signal });
  window.addEventListener('pageshow', () => { present = true; sync(); }, { signal });
  sync();
  const pausedAnimations = [];
  return {
    takeOver() {
      savedElapsed = elapsed;
      taken = true;
      trails.style.visibility = 'hidden';
      parallax.suspend(true);
      const captures = links.map(link => {
        const bounds = link.getBoundingClientRect();
        const source = link.querySelector('.orb-art');
        const art = source.cloneNode(true);
        const originals = [source, ...source.querySelectorAll('*')];
        const copies = [art, ...art.querySelectorAll('*')];
        originals.forEach((node, i) => {
          const computed = getComputedStyle(node);
          for (const property of computed) copies[i].style.setProperty(property, computed.getPropertyValue(property));
          copies[i].style.animation = 'none';
          copies[i].style.transition = 'none';
        });
        for (const animation of link.getAnimations({ subtree: true })) {
          if (animation.playState === 'running') { pausedAnimations.push(animation); animation.pause(); }
        }
        link.style.visibility = 'hidden';
        link.inert = true;
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, size: bounds.width, art };
      });
      cutouts.forEach(node => { node.style.visibility = 'hidden'; });
      sync();
      return captures;
    },
    returnTargets() {
      return links.map(link => {
        const box = link.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, size: box.width };
      });
    },
    restore() {
      if (!taken) return;
      taken = false;
      trails.style.visibility = '';
      elapsed = savedElapsed;
      trailElapsed = elapsed;
      drawTrails();
      previous = 0;
      links.forEach((link, i) => {
        const [x, y] = position(i, state.layout, elapsed);
        link.style.left = `${x / 640 * 100}%`;
        link.style.top = `${y / 440 * 100}%`;
        link.style.visibility = '';
        link.inert = false;
      });
      cutouts.forEach(node => { node.style.visibility = ''; });
      pausedAnimations.splice(0).forEach(animation => animation.play());
      parallax.suspend(false);
      sync();
    },
    dispose() {
      controller.abort(); cancelAnimationFrame(frame); resizeObserver.disconnect(); parallax.dispose(); area.remove();
    },
  };
}
