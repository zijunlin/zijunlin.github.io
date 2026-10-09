import { mountGameEntry } from './game-entry.js';
import { mountBackground } from '../features/background/background.js';
import { worldState } from './world-state.js';
import { mountReadingPanels } from '../features/reading-panels/reading-panels.js';
import { mountWorkPreview } from '../features/work-preview/work-preview.js';
import { mountWorldFallback } from '../features/world/world-fallback.js';

// Completion is driven by scene loading and mounting, never by a minimum wait.
const content = document.getElementById('content');
const loading = document.getElementById('world-loading');
const scene = document.getElementById('world-entry');
let world;
mountGameEntry(scene, () => world);

async function enterWorld() {
  try {
    const { mountWorld } = await import('../features/world/world-scene.js');
    world = await mountWorld(scene, worldState);
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

mountBackground(document.getElementById('shader-canvas'), worldState);
mountReadingPanels(content);
mountWorkPreview();
void enterWorld();
