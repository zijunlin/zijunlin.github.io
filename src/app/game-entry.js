import { prepareHomeGame } from './home-game-adapter.js';
import gameUrl from 'virtual:space-game-url';

// This module is the entire eager game boundary. The game owns no resources until accepted.
export function mountGameEntry(scene, getWorld) {
  const fine = matchMedia('(pointer: fine) and (hover: hover)');
  let elapsed = 0, last = performance.now(), consumed = false, generation = 0;
  let dialog, session, returnFocus;
  const text = (zh, en) => document.documentElement.lang === 'en' ? en : zh;
  const eligible = () => !location.hash.replace('#', '') && !document.hidden && document.hasFocus()
    && fine.matches && innerWidth >= 800 && innerHeight >= 600 && !scene.hidden
    && !document.querySelector('dialog[open]:not([data-game-dialog]), .reading-panel:not([hidden])');
  function closeDialog() { dialog?.close(); dialog?.remove(); dialog = null; }
  function leave(restoreFocus = true) {
    generation++;
    closeDialog();
    session?.dispose(); session = null;
    if (restoreFocus && !location.hash.replace('#', '')) returnFocus?.focus({ preventScroll: true });
  }
  function show(title, actions) {
    closeDialog();
    dialog = document.createElement('dialog');
    dialog.dataset.gameDialog = '';
    dialog.style.cssText = 'color:#dcebed;background:#111b24;border:1px solid #78949e;border-radius:18px;padding:30px;max-width:min(420px,85vw)';
    const heading = document.createElement('h2');
    heading.id = 'game-dialog-title'; heading.textContent = title;
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading);
    for (const [label, action] of actions) {
      const button = document.createElement('button');
      button.textContent = label; button.style.cssText = 'margin:8px;padding:10px 18px;cursor:pointer';
      button.addEventListener('click', action); dialog.append(button);
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); leave(); });
    document.body.append(dialog); dialog.showModal();
  }
  async function load() {
    const token = ++generation;
    show(text('正在准备游戏…', 'Preparing your game…'), [[text('取消', 'Cancel'), () => leave()]]);
    try {
      const { startGame } = await import(/* @vite-ignore */ `${gameUrl}?attempt=${token}`);
      if (token !== generation) return;
      if (!eligible()) { leave(); return; }
      closeDialog();
      const presentation = prepareHomeGame(scene, getWorld());
      try { session = startGame({ presentation, leave, text }); }
      catch (error) { presentation.dispose(); throw error; }
    } catch {
      if (token !== generation) return;
      show(text('加载失败，请重试', 'Loading failed. Try again.'), [
        [text('重试', 'Retry'), load], [text('返回首页', 'Return home'), () => leave()],
      ]);
    }
  }
  const interval = setInterval(() => {
    const now = performance.now();
    const delta = Math.min(now - last, 250); last = now;
    if (consumed || !eligible() || document.querySelector('dialog[open]')) return;
    elapsed += delta;
    if (elapsed < 10000) return;
    invite();
  }, 100);
  function invite() {
    if (dialog || session || !eligible()) return;
    consumed = true;
    clearInterval(interval);
    returnFocus = document.activeElement === document.body ? scene.querySelector('a') : document.activeElement;
    show(text('来一场星际冒险？', 'Ready for a space adventure?'), [
      [text('开始游戏', 'Start game'), load], [text('暂时不了', 'Not now'), () => leave()],
    ]);
  }

  // Capture navigation before site content handlers restore their own focus.
  window.addEventListener('popstate', () => leave(false), { capture: true });
  window.addEventListener('hashchange', () => leave(false), { capture: true });
  window.addEventListener('pagehide', () => leave(false));
  window.addEventListener('keydown', event => {
    if (event.shiftKey && event.key.toLowerCase() === 'g' && !event.ctrlKey && !event.metaKey && !event.altKey
      && !event.repeat && !event.isComposing && !event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      && !dialog && !session && eligible()) {
      event.preventDefault();
      invite();
      return;
    }
    if ((dialog || session) && event.key === 'Escape') {
      event.stopImmediatePropagation(); event.preventDefault();
      if (session) session.escape(); else leave();
    }
  }, { capture: true });
}
