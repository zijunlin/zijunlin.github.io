import {
  Scene, OrthographicCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
  Mesh, MeshStandardMaterial, CylinderGeometry, TorusGeometry, TubeGeometry,
  CatmullRomCurve3, Vector3, PCFSoftShadowMap,
} from 'three';

// Approved C objects and A/B placement from the visual integration study.
const regions = [
  { id: 'about', label: '关于我' },
  { id: 'career', label: '职业历程' },
  { id: 'work', label: '作品集' },
  { id: 'notes', label: '随笔' },
];
const layouts = {
  A: [[-100, -62, 160, 126], [-60, 100, 113, 341], [8, 5, 397, 249], [65, -100, 499, 208]],
  B: [[-125, 20, 122, 164], [-50, 15, 202, 277], [30, -20, 465, 192], [112, -15, 484, 323]],
};

function buildIsland(scene, layout) {
  const materials = new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new MeshStandardMaterial({ color, roughness: 0.9 }));
    return materials.get(color);
  }
  function add(geometry, color, x, y, z) {
    const mesh = new Mesh(geometry, material(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function drum(x, z, bottom, radius, height, color) {
    return add(new CylinderGeometry(radius, radius, height, 64), color, x, bottom + height / 2, z);
  }
  function ring(x, z, height, radius, thickness, color) {
    const mesh = add(new TorusGeometry(radius, thickness, 8, 64), color, x, height, z);
    mesh.rotation.x = -Math.PI / 2;
  }
  drum(0, 0, -36, 147, 14, '#273c46');
  drum(0, 0, -22, 137, 12, '#344a52');
  drum(0, 0, -10, 123, 10, '#4b6063');

  const placed = regions.map((region, i) => {
    const [x, z, lx, ly] = layouts[layout][i];
    return { ...region, x, z, lx, ly };
  });
  // A closes around the central workshop; B joins the four regions in order.
  const pathPoints = layout === 'A'
    ? [[-100, -62], [10, -105], [65, -100], [110, 20], [-60, 100], [-115, 35]]
    : placed.map(({ x, z }) => [x, z]);
  const path = new CatmullRomCurve3(pathPoints.map(([x, z]) => new Vector3(x, 2, z)), layout === 'A', 'centripetal');
  add(new TubeGeometry(path, 96, 1.5, 8, layout === 'A'), '#82958c', 0, 0, 0);

  for (const { id, x, z } of placed) {
    if (id === 'about') {
      drum(x, z, 0, 24, 12, '#798b8e');
      drum(x, z, 12, 17, 39, '#bcc5c1');
      drum(x, z, 51, 20, 3, '#d2d6cc');
      ring(x, z, 56, 9, 1, '#d4ac70');
    } else if (id === 'work') {
      drum(x, z, 0, 42, 10, '#74878a');
      drum(x, z, 12, 34, 17, '#bcc5c1');
      drum(x, z, 32, 25, 16, '#dedfd3');
      drum(x, z, 48, 17, 1, '#334950');
      ring(x, z, 50, 11, 2, '#bda574');
    } else if (id === 'career') {
      ring(x, z, 4, 34, 3.5, '#798b8e');
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI / 2.5;
        drum(x + Math.cos(angle) * 34, z + Math.sin(angle) * 34, 4, 3, 4, '#cfaa73');
      }
    } else {
      drum(x, z, 0, 26, 6, '#687c79');
      drum(x, z, 6, 19, 0.5, '#334b46');
      ring(x, z, 7, 19, 1.5, '#94a39a');
      ring(x, z, 9, 10, 0.5, '#798b8e');
    }
  }
  return placed;
}

function addEntrances(stage, placed, camera) {
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('viewBox', '0 0 640 440');
  lines.setAttribute('aria-hidden', 'true');
  lines.classList.add('island-connectors');
  for (const region of placed) {
    const point = new Vector3(region.x, 0, region.z).project(camera);
    const line = document.createElementNS(lines.namespaceURI, 'path');
    line.setAttribute('d', `M${(point.x + 1) * 320},${(1 - point.y) * 220} L${region.lx},${region.ly - 15}`);
    lines.append(line);
    const link = document.createElement('a');
    link.className = 'island-label';
    link.href = `#${region.id}`;
    link.textContent = region.label;
    link.style.left = `${region.lx / 640 * 100}%`;
    link.style.top = `${region.ly / 440 * 100}%`;
    stage.append(link);
  }
  stage.prepend(lines);
  const featured = document.createElement('a');
  featured.className = 'island-featured';
  featured.href = '#work/platform';
  featured.textContent = '精选作品 · 智能语音平台';
  stage.append(featured);
}

export async function mountIsland(container, layout) {
  const area = document.createElement('section');
  area.className = 'island-area';
  area.setAttribute('aria-label', `建筑地形小岛 · ${layout === 'A' ? '环绕核心' : '成长路径'}`);
  const stage = document.createElement('div');
  stage.className = 'island-stage';
  area.append(stage);
  container.append(area);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '层叠曲面小岛');
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
    message.className = 'island-unavailable';
    message.textContent = '当前浏览器暂时无法显示小岛世界。请尝试支持 WebGL 2 的浏览器。';
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
    const placed = buildIsland(scene, layout);
    renderer.setSize(640, 440, false);
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
    stage.append(canvas);
    addEntrances(stage, placed, camera);
    // This world is static: render only for resize, not in a second animation loop.
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
