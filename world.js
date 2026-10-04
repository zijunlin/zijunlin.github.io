import { worldState } from './world-state.js';
import { mountReadingPanels } from './reading-panels.js';
import { mountWorkPreview } from './work-preview.js';

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
    document.getElementById('world-error').hidden = false;
  } finally {
    loading.hidden = true;
    content.setAttribute('aria-busy', 'false');
  }
}

mountReadingPanels(content);
mountWorkPreview();
void enterWorld();
