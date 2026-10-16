import { prepareHomeGame } from './home-game-adapter.js';
import gameUrl from 'virtual:space-game-url';

// This module is the entire eager game boundary. The game owns no resources until eligible automatic entry.
export function mountGameEntry(scene, getWorld, graphics) {
  const pressed = new Set();
  window.addEventListener('pointerdown', event => pressed.add(event.pointerId), { capture: true });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, event => pressed.delete(event.pointerId), { capture: true });
  window.addEventListener('blur', () => pressed.clear());
  let elapsed = 0, last = performance.now(), consumed = false, generation = 0;
  let dialog, session, returnFocus, loadingNotice, loadingTimer, loadingLanguage, loadingCancel;
  let loading = false, readyToStart, waitingForGraphics = false;
  let modulePromise, importAttempt = 0;
  function loadModule() {
    // Session cancellation must not create a new module identity. A successful
    // import is shared by later runs; only a failed import needs a fresh URL.
    if (!modulePromise) {
      modulePromise = import(/* @vite-ignore */ `${gameUrl}?attempt=${++importAttempt}`).catch(error => {
        modulePromise = undefined;
        throw error;
      });
    }
    return modulePromise;
  }
  const text = (zh, en) => document.documentElement.lang === 'en' ? en : zh;
  const eligible = () => !location.hash.replace('#', '') && !document.hidden && document.hasFocus()
    && innerWidth >= 280 && innerHeight >= 280 && !scene.hidden
    && !document.querySelector('dialog[open]:not([data-game-dialog]), .reading-panel:not([hidden])');
  function closeDialog() { dialog?.close(); dialog?.remove(); dialog = null; }
  function clearLoading() {
    loading = false;
    readyToStart = null;
    clearTimeout(loadingTimer);
    loadingLanguage?.disconnect(); loadingLanguage = null;
    loadingNotice?.remove(); loadingNotice = null;
    loadingCancel?.remove(); loadingCancel = null;
  }
  function leave(restoreFocus = true) {
    waitingForGraphics = false;
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
      loadingCancel = document.createElement('button');
      loadingCancel.type = 'button';
      loadingCancel.setAttribute('translate', 'no');
      loadingCancel.style.cssText = 'position:fixed;z-index:6;bottom:max(24px,env(safe-area-inset-bottom));right:24px;min-height:44px;padding:10px 18px;color:#dcebed;background:#111b24;border:1px solid #78949e;border-radius:12px;cursor:pointer';
      loadingCancel.addEventListener('click', () => { consumed = true; leave(); });
      const updateNotice = () => {
        loadingCancel.textContent = text('取消游戏', 'Cancel game');
        loadingNotice.textContent = matchMedia('(pointer: coarse)').matches
          ? text('正在准备游戏…', 'Preparing your game…')
          : text('正在准备游戏… 按 Esc 取消', 'Preparing your game… Press Esc to cancel');
      };
      updateNotice();
      loadingLanguage = new MutationObserver(updateNotice);
      loadingLanguage.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      loadingNotice.style.cssText = 'position:fixed;z-index:5;bottom:max(80px,calc(env(safe-area-inset-bottom) + 56px));left:24px;color:#dcebed;pointer-events:none';
      document.body.append(loadingNotice, loadingCancel);
    }, 300);
    try {
      const { startGame } = await loadModule();
      if (token !== generation) return;
      readyToStart = () => {
        if (token !== generation || pressed.size) return;
        if (!eligible()) { leave(false); return; }
        if (!graphics.available) { clearLoading(); showUnavailable(); return; }
        clearLoading();
        const presentation = prepareHomeGame(scene, getWorld(), graphics);
        try {
          const started = startGame({ presentation, leave, text });
          // The first draw can fail while startGame still owns its resources.
          if (token !== generation || !graphics.available) {
            started.dispose();
            if (!graphics.available) showUnavailable();
            return;
          }
          session = started;
          consumed = true;
        } catch {
          presentation.dispose();
          if (graphics.available) showLoadFailure(); else showUnavailable();
        }
      };
      if (!pressed.size) readyToStart();
    } catch {
      if (token !== generation) return;
      showLoadFailure();
    }
  }
  function showLoadFailure() {
    clearLoading();
    show(text('加载失败，请重试', 'Loading failed. Try again.'), [
      [text('重试', 'Retry'), load],
      [text('返回首页', 'Return home'), () => { consumed = true; leave(); }],
    ]);
  }
  function showUnavailable() {
    consumed = true;
    waitingForGraphics = graphics.status === 'recovering';
    show(waitingForGraphics ? text('正在恢复图形', 'Restoring graphics')
      : text('当前图形功能不可用，暂时无法开始游戏', 'Graphics are unavailable. The game cannot start.'), [
      [text('返回首页', 'Return home'), () => leave()],
    ]);
  }
  graphics.subscribe(status => {
    if (status === 'ready') {
      if (waitingForGraphics) closeDialog();
      waitingForGraphics = false;
      return;
    }
    pressed.clear(); resetTaps(); consumed = true;
    if (status === 'recovering') {
      // Cancel stale imports without discarding an already published session.
      generation++; clearLoading(); closeDialog();
    } else {
      const hadSession = Boolean(session) || waitingForGraphics;
      waitingForGraphics = false;
      leave(false);
      if (hadSession) showUnavailable();
    }
  });
  function enter() {
    if (session || loading || dialog || !eligible() || document.querySelector('dialog[open]')) return;
    returnFocus = document.activeElement === document.body ? scene.querySelector('a') : document.activeElement;
    if (!graphics.available) { showUnavailable(); return; }
    load();
  }
  // Touch-only shortcut: three short taps near one point on the empty home
  // background. Reading, controls, drags and extra fingers break the sequence.
  let tap, tapCount = 0, lastTap;
  const resetTaps = () => { tap = null; tapCount = 0; lastTap = null; };
  const blankHome = target => eligible() && !session && !loading && !dialog
    && !target.closest('a, button, input, textarea, select, [role="button"], [contenteditable], nav, header, footer, dialog, .reading-panel, .scene-heading');
  window.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary || pressed.size !== 1 || !blankHome(event.target)) {
      resetTaps(); return;
    }
    tap = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() };
  }, { capture: true });
  window.addEventListener('pointermove', event => {
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 12) resetTaps();
  }, { capture: true });
  window.addEventListener('pointerup', event => {
    if (tap?.id !== event.pointerId) return;
    const now = performance.now(), current = tap;
    tap = null;
    if (!blankHome(event.target) || now - current.at > 350
      || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 12) { resetTaps(); return; }
    const consecutive = lastTap && now - lastTap.at <= 500
      && Math.hypot(current.x - lastTap.x, current.y - lastTap.y) <= 32;
    tapCount = consecutive ? tapCount + 1 : 1;
    lastTap = { ...current, at: now };
    if (tapCount === 3) { resetTaps(); enter(); }
  }, { capture: true });
  for (const type of ['pointercancel', 'blur', 'hashchange', 'popstate']) window.addEventListener(type, resetTaps);
  document.addEventListener('visibilitychange', resetTaps);
  const interval = setInterval(() => {
    const now = performance.now();
    const delta = Math.min(now - last, 250); last = now;
    if (readyToStart && !pressed.size) { readyToStart(); return; }
    if (!graphics.available || consumed || !eligible() || document.querySelector('dialog[open]')) return;
    elapsed += delta;
    if (elapsed < 10000 || pressed.size) return;
    enter();
  }, 100);
  // Capture navigation before site content handlers restore their own focus.
  let navigationUrl = location.href;
  function navigate() {
    // A fragment navigation emits popstate, then hashchange. Cached imports
    // may finish between them; the second event must not cancel the new run.
    if (navigationUrl === location.href) return;
    navigationUrl = location.href;
    leave(false);
  }
  window.addEventListener('popstate', navigate, { capture: true });
  window.addEventListener('hashchange', navigate, { capture: true });
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
      if (session) session.escape(); else { consumed = true; leave(); }
    }
  }, { capture: true });
}
