import { Raycaster, Vector2, Vector3 } from 'three';

const descriptions = {
  about: '了解我的工程实践与关注方向。',
  career: '沿着项目经历，看看一路的选择。',
  work: '从智能语音平台，了解我的工程实践。',
  notes: '这里留给思考与记录，目前暂无正文。',
};

// Project actual vertices once: the fixed camera and proportional stage keep
// these screen-space targets aligned at every supported viewport size.
function objectTarget(object, camera) {
  const point = new Vector3();
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  object.updateMatrixWorld(true);
  object.traverse(mesh => {
    const positions = mesh.geometry?.attributes.position;
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(camera);
      const x = (point.x + 1) * 320, y = (1 - point.y) * 220;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  });
  return { x: left - 8, y: top - 8, width: right - left + 16, height: bottom - top + 16 };
}

export function addEntrances(stage, placed, camera, render, onContextChange) {
  const entrances = [];
  let hovered, focused, selected, preview = false;
  let activeId, selectedId, wasPreview;
  function update() {
    const active = hovered || focused || selected;
    if (active === activeId && selected === selectedId && preview === wasPreview) return;
    activeId = active;
    selectedId = selected;
    wasPreview = preview;
    for (const entrance of entrances) {
      const highlighted = entrance.id === active;
      entrance.link.classList.toggle('is-active', highlighted);
      entrance.line.classList.toggle('is-active', highlighted);
      entrance.description.hidden = !highlighted || preview;
      entrance.object.traverse(mesh => {
        if (!mesh.material) return;
        mesh.material.emissive.set('#d4ac70');
        mesh.material.emissiveIntensity = highlighted ? 0.35 : 0;
      });
    }
    onContextChange({ active, selected });
    render();
  }
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('viewBox', '0 0 640 440');
  lines.setAttribute('aria-hidden', 'true');
  lines.classList.add('world-connectors');
  const targets = document.createElementNS(lines.namespaceURI, 'svg');
  targets.setAttribute('viewBox', '0 0 640 440');
  targets.setAttribute('aria-hidden', 'true');
  targets.classList.add('world-targets');
  const target = document.createElementNS(lines.namespaceURI, 'a');
  target.setAttribute('tabindex', '-1');
  targets.append(target);
  for (const region of placed) {
    const point = new Vector3(region.x, 0, region.z).project(camera);
    const line = document.createElementNS(lines.namespaceURI, 'path');
    line.setAttribute('d', `M${(point.x + 1) * 320},${(1 - point.y) * 220} L${region.labelX},${region.labelY - 15}`);
    lines.append(line);
    const link = document.createElement('a');
    link.className = 'world-label';
    link.href = `#${region.id}`;
    link.textContent = region.label;
    link.style.left = `${region.labelX / 640 * 100}%`;
    link.style.top = `${region.labelY / 440 * 100}%`;
    const description = document.createElement('span');
    description.className = 'world-description';
    description.id = `world-description-${region.id}`;
    description.textContent = descriptions[region.id];
    description.hidden = true;
    link.setAttribute('aria-describedby', description.id);
    const bounds = objectTarget(region.object, camera);
    const hitArea = document.createElementNS(lines.namespaceURI, 'rect');
    for (const [name, value] of Object.entries(bounds)) {
      hitArea.setAttribute(name, value);
    }
    hitArea.setAttribute('rx', '8');
    target.append(hitArea);
    entrances.push({ id: region.id, link, line, description, object: region.object, bounds });
    link.addEventListener('pointerenter', () => { hovered = region.id; update(); });
    link.addEventListener('pointerleave', () => { hovered = undefined; update(); });
    link.addEventListener('focus', () => { hovered = undefined; focused = region.id; update(); });
    link.addEventListener('blur', () => { focused = undefined; update(); });
    stage.append(link, description);
  }
  const raycaster = new Raycaster();
  function resolveTarget(event) {
    const frame = stage.getBoundingClientRect();
    const x = (event.clientX - frame.left) / frame.width * 640;
    const y = (event.clientY - frame.top) / frame.height * 440;
    const candidates = entrances.filter(({ bounds: b }) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
    raycaster.setFromCamera(new Vector2(x / 320 - 1, 1 - y / 220), camera);
    const hit = raycaster.intersectObjects(candidates.map(entry => entry.object), true)[0];
    // Visible geometry wins; only empty padding uses the nearest target centre.
    if (hit) return candidates.find(entry => entry.object === hit.object.parent);
    const distance = ({ bounds: b }) => (x - b.x - b.width / 2) ** 2 + (y - b.y - b.height / 2) ** 2;
    return candidates.sort((a, b) => distance(a) - distance(b))[0];
  }
  function pointAt(event) {
    const entrance = resolveTarget(event);
    if (entrance) target.setAttribute('href', entrance.link.getAttribute('href'));
    else target.removeAttribute('href');
    hovered = entrance?.id;
    update();
    return entrance;
  }
  target.addEventListener('pointerenter', pointAt);
  target.addEventListener('pointermove', pointAt);
  target.addEventListener('pointerdown', pointAt);
  target.addEventListener('pointerleave', () => { hovered = undefined; update(); });
  // Native link navigation retains modifier-click behavior; only the label is tabbable.
  target.addEventListener('click', event => pointAt(event)?.link.focus({ preventScroll: true }));
  stage.prepend(lines);
  stage.append(targets);
  const featured = document.createElement('a');
  featured.className = 'world-featured';
  featured.href = '#work/platform';
  featured.textContent = '精选作品 · 智能语音平台';
  stage.append(featured);
  function syncRoute() {
    preview = location.hash === '#work/platform';
    const route = location.hash.slice(1);
    selected = preview ? selected || 'work' : entrances.find(entry => entry.id === route)?.id;
    hovered = focused = undefined;
    update();
  }
  window.addEventListener('hashchange', syncRoute);
  syncRoute();
  return () => window.removeEventListener('hashchange', syncRoute);
}
