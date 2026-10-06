import { worldState } from './world-state.js';
import { mountReadingPanels } from './reading-panels.js';
import { mountWorkPreview } from './work-preview.js';
import { mountWorldFallback } from './world-fallback.js';

// Completion is driven by scene loading and mounting, never by a minimum wait.
const content = document.getElementById('content');
const loading = document.getElementById('world-loading');
const scene = document.getElementById('world-entry');

async function enterWorld() {
  try {
    const { mountWorld } = await import('./world-scene.js');
    await mountWorld(scene, worldState);
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

mountReadingPanels(content);
mountWorkPreview();
void enterWorld();
