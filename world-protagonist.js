import { protagonistArt } from './protagonist-art.js';

// Coordinates and scale match the approved 640 × 440 integration composition.
export function mountProtagonist(stage, layout) {
  const slot = document.createElement('div');
  slot.className = 'world-protagonist-slot';
  slot.innerHTML = `<svg class="world-protagonist" viewBox="-24 -80 48 90" role="group" aria-label="主角精灵：随行创造者">
    ${protagonistArt}
  </svg>`;
  const character = slot.firstElementChild;
  const restingX = layout === 'A' ? 320 : 302;
  function respond({ active, selected }) {
    const offset = selected ? (['about', 'career'].includes(selected) ? -24 : 24) : 0;
    character.style.left = `${(restingX + offset - 24) / 640 * 100}%`;
    character.classList.toggle('is-responding', Boolean(active));
  }
  respond({});
  stage.append(slot);
  const controller = new AbortController();
  const { signal } = controller;
  let focused = document.hasFocus(), present = true;
  function sync() {
    slot.classList.toggle('is-paused', !focused || !present || document.hidden || location.hash === '#work/platform');
  }
  window.addEventListener('blur', () => { focused = false; sync(); }, { signal });
  window.addEventListener('focus', () => { focused = true; sync(); }, { signal });
  window.addEventListener('pagehide', () => { present = false; sync(); }, { signal });
  window.addEventListener('pageshow', () => { present = true; focused = document.hasFocus(); sync(); }, { signal });
  document.addEventListener('visibilitychange', sync, { signal });
  window.addEventListener('hashchange', sync, { signal });
  sync();
  return { respond, dispose() { controller.abort(); slot.remove(); } };
}
