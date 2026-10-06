import { Scene, OrthographicCamera, WebGLRenderer, HemisphereLight, DirectionalLight, PCFSoftShadowMap } from 'three';
import { buildWorldGeometry } from './world-geometry.js';
import { addEntrances } from './world-entrances.js';
import { mountWorldParallax } from './world-parallax.js';
import { mountProtagonist } from './world-protagonist.js';
import { mountWorldFallback } from './world-fallback.js';

const presentations = {
  island: { name: '建筑地形小岛', image: '层叠曲面小岛', description: '圆形居所、职业历程步道、中央工坊与下沉庭园。' },
  system: { name: '抽象系统空间', image: '层叠曲面系统空间', description: '身份节点、环形时间总线、同轴核心模块与空闲实验区。' },
};

export async function mountWorldView(container, state, { canvas, context }) {
  const { world, layout } = state;
  const presentation = presentations[world];
  const area = document.createElement('section');
  area.className = 'world-area';
  area.setAttribute('aria-label', `${presentation.name} · ${layout === 'A' ? '环绕核心' : '成长路径'}`);
  const stage = document.createElement('div');
  stage.className = 'world-stage';
  area.append(stage);
  container.append(area);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', presentation.image);
  canvas.setAttribute('aria-description', presentation.description);
  let renderer, observer, disposeParallax, protagonist, disposeEntrances;
  let failed = false;
  const scene = new Scene();
  function fail() {
    if (failed) return;
    failed = true;
    canvas.removeEventListener('webglcontextlost', fail);
    area.remove();
    mountWorldFallback(container);
    disposeParallax?.();
    protagonist?.dispose();
    disposeEntrances?.();
    observer?.disconnect();
    renderer?.dispose();
    scene.traverse(object => { object.geometry?.dispose(); });
    const materials = new Set();
    scene.traverse(object => { if (object.material) materials.add(object.material); });
    for (const material of materials) material.dispose();
  }
  try {
    if (context.isContextLost()) { fail(); return; }
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.debug.onShaderError = () => { throw new Error('World rendering unavailable'); };
    canvas.addEventListener('webglcontextlost', fail, { once: true });
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
    if (failed || context.isContextLost()) { fail(); return; }
    renderer.render(scene, camera);
    stage.append(canvas);
    protagonist = mountProtagonist(stage, layout);
    disposeEntrances = addEntrances(stage, placed, camera, () => {
      if (failed) return;
      try { renderer.render(scene, camera); } catch { fail(); }
    }, protagonist.respond);
    if (failed) { disposeEntrances(); return; }
    // Render on interaction and resize, without a second animation loop.
    observer = new ResizeObserver(() => {
      try {
        if (failed || !stage.clientWidth) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.setSize(stage.clientWidth, stage.clientHeight, false);
        renderer.render(scene, camera);
      } catch { fail(); }
    });
    observer.observe(stage);
    disposeParallax = mountWorldParallax(stage, document.getElementById('shader-canvas'));
  } catch { fail(); }
}
