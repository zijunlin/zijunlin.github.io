import { Scene, OrthographicCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Vector3, PCFSoftShadowMap } from 'three';
import { buildWorldGeometry } from './world-geometry.js';

const presentations = {
  island: { name: '建筑地形小岛', shortName: '小岛世界', image: '层叠曲面小岛', description: '圆形居所、职业历程步道、中央工坊与下沉庭园。' },
  system: { name: '抽象系统空间', shortName: '系统空间', image: '层叠曲面系统空间', description: '身份节点、环形时间总线、同轴核心模块与空闲实验区。' },
};

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

function addEntrances(stage, placed, camera, render) {
  const entrances = [];
  let hovered, focused;
  function update() {
    const active = hovered || focused;
    for (const entrance of entrances) {
      const selected = entrance.id === active;
      entrance.link.classList.toggle('is-active', selected);
      entrance.line.classList.toggle('is-active', selected);
      entrance.description.hidden = !selected;
      entrance.object.traverse(mesh => {
        if (!mesh.material) return;
        mesh.material.emissive.set('#d4ac70');
        mesh.material.emissiveIntensity = selected ? 0.35 : 0;
      });
    }
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
    const target = document.createElementNS(lines.namespaceURI, 'a');
    target.setAttribute('href', link.getAttribute('href'));
    target.setAttribute('tabindex', '-1');
    const hitArea = document.createElementNS(lines.namespaceURI, 'rect');
    for (const [name, value] of Object.entries(objectTarget(region.object, camera))) {
      hitArea.setAttribute(name, value);
    }
    hitArea.setAttribute('rx', '8');
    target.append(hitArea);
    targets.append(target);
    entrances.push({ id: region.id, link, line, description, object: region.object });
    for (const surface of [link, target]) {
      surface.addEventListener('pointerenter', () => { hovered = region.id; update(); });
      surface.addEventListener('pointerleave', () => { hovered = undefined; update(); });
    }
    // Keep the semantic label as the sole keyboard/screen-reader entrance.
    target.addEventListener('click', () => link.focus({ preventScroll: true }));
    link.addEventListener('focus', () => { hovered = undefined; focused = region.id; update(); });
    link.addEventListener('blur', () => { focused = undefined; update(); });
    stage.append(link, description);
  }
  stage.prepend(lines);
  stage.append(targets);
  const featured = document.createElement('a');
  featured.className = 'world-featured';
  featured.href = '#work/platform';
  featured.textContent = '精选作品 · 智能语音平台';
  stage.append(featured);
}

export async function mountWorldView(container, state) {
  const { world, layout } = state;
  const presentation = presentations[world];
  const area = document.createElement('section');
  area.className = 'world-area';
  area.setAttribute('aria-label', `${presentation.name} · ${layout === 'A' ? '环绕核心' : '成长路径'}`);
  const stage = document.createElement('div');
  stage.className = 'world-stage';
  area.append(stage);
  container.append(area);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', presentation.image);
  canvas.setAttribute('aria-description', presentation.description);
  let renderer, observer;
  const scene = new Scene();
  function fail() {
    observer?.disconnect();
    renderer?.dispose();
    scene.traverse(object => { object.geometry?.dispose(); });
    const materials = new Set();
    scene.traverse(object => { if (object.material) materials.add(object.material); });
    for (const material of materials) material.dispose();
    const message = document.createElement('p');
    message.className = 'world-unavailable';
    message.textContent = `当前浏览器暂时无法显示${presentation.shortName}。请尝试支持 WebGL 2 的浏览器。`;
    stage.replaceChildren(message);
  }
  try {
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!context) { fail(); return; }
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    const camera = new OrthographicCamera(-240.6, 240.6, 165.4, -165.4, 1, 2000);
    camera.position.set(400, 342, 400);
    camera.lookAt(0, 26, 0);
    camera.updateMatrixWorld();
    scene.add(new HemisphereLight('#e4ede7', '#25363d', 2));
    const light = new DirectionalLight('#fff3da', 2.5);
    light.position.set(-150, 300, 160);
    light.castShadow = true;
    Object.assign(light.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, far: 800 });
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.normalBias = 1;
    scene.add(light);
    const placed = buildWorldGeometry(scene, state);
    renderer.setSize(640, 440, false);
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
    stage.append(canvas);
    addEntrances(stage, placed, camera, () => {
      try { renderer.render(scene, camera); } catch { fail(); }
    });
    // Render on interaction and resize, without a second animation loop.
    observer = new ResizeObserver(() => {
      try {
        if (!stage.clientWidth) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.setSize(stage.clientWidth, stage.clientHeight, false);
        renderer.render(scene, camera);
      } catch { fail(); }
    });
    observer.observe(stage);
    canvas.addEventListener('webglcontextlost', fail, { once: true });
  } catch { fail(); }
}
