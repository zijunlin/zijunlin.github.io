import { prepareHomeGame } from './home-game-adapter.js';
import gameUrl from 'virtual:space-game-url';

// This module is the entire eager game boundary. The game owns no resources until eligible automatic entry.
export function mountGameEntry(scene, getWorld) {
  const pressed = new Set();
  window.addEventListener('pointerdown', event => pressed.add(event.pointerId), { capture: true });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, event => pressed.delete(event.pointerId), { capture: true });
  window.addEventListener('blur', () => pressed.clear());
  let elapsed = 0, last = performance.now(), consumed = false, generation = 0;
  let dialog, session, returnFocus, loadingNotice, loadingTimer, loadingLanguage;
  let loading = false;
  const text = (zh, en) => document.documentElement.lang === 'en' ? en : zh;
  const eligible = () => !location.hash.replace('#', '') && !document.hidden && document.hasFocus()
    && innerWidth >= 280 && innerHeight >= 280 && !scene.hidden
    && !document.querySelector('dialog[open]:not([data-game-dialog]), .reading-panel:not([hidden])');
  function closeDialog() { dialog?.close(); dialog?.remove(); dialog = null; }
  function clearLoading() {
    loading = false;
    clearTimeout(loadingTimer);
    loadingLanguage?.disconnect(); loadingLanguage = null;
    loadingNotice?.remove(); loadingNotice = null;
  }
  function leave(restoreFocus = true) {
    generation++;
    clearLoading();
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
    closeDialog();
    clearLoading();
    loading = true;
    loadingTimer = setTimeout(() => {
      loadingNotice = document.createElement('p');
      loadingNotice.setAttribute('role', 'status');
      loadingNotice.setAttribute('translate', 'no');
      const updateNotice = () => {
        loadingNotice.textContent = text('正在准备游戏… 按 Esc 取消', 'Preparing your game… Press Esc to cancel');
      };
      updateNotice();
      loadingLanguage = new MutationObserver(updateNotice);
      loadingLanguage.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      loadingNotice.style.cssText = 'position:fixed;z-index:5;bottom:24px;left:24px;color:#dcebed;pointer-events:none';
      document.body.append(loadingNotice);
    }, 300);
    try {
      const { startGame } = await import(/* @vite-ignore */ `${gameUrl}?attempt=${token}`);
      if (token !== generation) return;
      if (!eligible()) { leave(); return; }
      clearLoading();
      const presentation = prepareHomeGame(scene, getWorld());
      try { session = startGame({ presentation, leave, text }); }
      catch (error) { presentation.dispose(); throw error; }
    } catch {
      if (token !== generation) return;
      clearLoading();
      show(text('加载失败，请重试', 'Loading failed. Try again.'), [
        [text('重试', 'Retry'), load], [text('返回首页', 'Return home'), () => leave()],
      ]);
    }
  }
  function enter() {
    if (session || loading || dialog || !eligible() || document.querySelector('dialog[open]')) return;
    consumed = true;
    clearInterval(interval);
    returnFocus = document.activeElement === document.body ? scene.querySelector('a') : document.activeElement;
    load();
  }
  const interval = setInterval(() => {
    const now = performance.now();
    const delta = Math.min(now - last, 250); last = now;
    if (consumed || !eligible() || document.querySelector('dialog[open]')) return;
    elapsed += delta;
    if (elapsed < 10000 || pressed.size) return;
    enter();
  }, 100);
  // Capture navigation before site content handlers restore their own focus.
  window.addEventListener('popstate', () => leave(false), { capture: true });
  window.addEventListener('hashchange', () => leave(false), { capture: true });
  window.addEventListener('pagehide', () => leave(false));
  window.addEventListener('keydown', event => {
    const target = event.target;
    if (event.key.toLowerCase() === 'g' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
      && !event.repeat && !event.isComposing && !event.defaultPrevented
      && !target?.isContentEditable && !target?.closest?.('input, textarea, select, [role="textbox"]')) {
      if (!session && !loading && !dialog && eligible() && !document.querySelector('dialog[open]')) {
        event.preventDefault(); enter();
      }
    }
    if ((dialog || session || loading) && event.key === 'Escape') {
      event.stopImmediatePropagation(); event.preventDefault();
      if (session) session.escape(); else leave();
    }
  }, { capture: true });
}
