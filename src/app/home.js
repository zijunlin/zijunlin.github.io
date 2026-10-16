import { mountGameEntry } from './game-entry.js';
import { mountSharedRenderer } from '../features/scene/shared-renderer.js';
import { worldState } from './world-state.js';
import { mountReadingPanels } from '../features/reading-panels/reading-panels.js';
import { mountWorkPreview } from '../features/work-preview/work-preview.js';
import { mountWorldFallback } from '../features/world/world-fallback.js';

// Completion is driven by scene loading and mounting, never by a minimum wait.
const content = document.getElementById('content');
const loading = document.getElementById('world-loading');
const scene = document.getElementById('world-entry');
let world, generation = 0;
const graphics = mountSharedRenderer(document.getElementById('shader-canvas'), worldState);
mountGameEntry(scene, () => world, graphics);

async function enterWorld() {
  const token = ++generation;
  try {
    const { mountWorld } = await import('../features/world/world-scene.js');
    if (token !== generation) return;
    world = await mountWorld(scene, worldState, graphics);
    scene.hidden = false;
    scene.classList.add('entering');
  } catch {
    scene.replaceChildren();
    const error = document.getElementById('world-error');
    mountWorldFallback(error, '你仍可通过以下入口浏览全部内容，或稍后刷新重试。');
    error.hidden = false;
  } finally {
    loading.hidden = true;
    content.setAttribute('aria-busy', 'false');
  }
}

graphics.subscribe(status => {
  scene.style.animationPlayState = status === 'recovering' ? 'paused' : '';
  if (status !== 'unavailable') return;
  if (!world) return; // An in-flight mount reads the current graphics status.
  world.dispose(); world = undefined; void enterWorld();
});
mountReadingPanels(content);
mountWorkPreview();
void enterWorld();
