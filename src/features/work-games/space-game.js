import css from './space-game.css?inline';
import { mountGamePerformance } from './game-performance.js';
import { createBattle } from './battle.js';
import { constrainShipPosition } from './rules.js';
import { describePickup } from './pickup-presentation.js';

export function startGame({ presentation, leave, text }) {
  const panel = document.createElement('section'); panel.className = 'space-game'; panel.tabIndex = -1;
  panel.style.setProperty('--game-hud-top', presentation.hudTop);
  const style = document.createElement('style'); style.textContent = css; panel.append(style);
  const hud = document.createElement('div'); hud.className = 'game-hud'; hud.setAttribute('translate', 'no');
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const instructions = document.createElement('p'), score = document.createElement('p');
  score.className = 'game-score';
  const feedback = document.createElement('p'); feedback.className = 'game-pickup'; feedback.setAttribute('role', 'status');
  const shockwave = document.createElement('p'); shockwave.className = 'game-shockwave';
  hud.append(status, instructions, score, feedback, shockwave); panel.append(hud);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(any-pointer: coarse)').matches;
  // Use one uniform world scale for drawing, collision and movement. Keep it
  // stable throughout a run, including orientation changes.
  const scale = innerWidth >= 800 && innerHeight >= 600 ? 1 : Math.max(.5, Math.min(innerWidth, innerHeight) / 800);
  const point = value => ({ ...value, x: value.x / scale, y: value.y / scale, size: value.size / scale });
  const gamePerformance = mountGamePerformance({ onFrame: draw, effects: () => battle && (phase === 'battle' || phase === 'results') ? { state: battle.state, bounds: bounds(), scale } : null, presentation: {
    ...presentation, satellites: presentation.satellites.map(point),
    returnTargets: () => presentation.returnTargets().map(point),
  }, reduced, scale });
  const controls = document.createElement('div'); controls.className = 'game-controls';
  const waveButton = document.createElement('button');
  waveButton.className = 'game-wave';
  controls.append(waveButton);
  if (touch) panel.append(controls);
  const surface = document.createElement('div'); surface.className = 'game-touch'; surface.setAttribute('aria-hidden', 'true');
  panel.prepend(surface);
  let drag, target;
  const activeTouches = new Set();
  function clearDrag() {
    const id = drag?.id; drag = null; target = null;
    if (id !== undefined && surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
  }
  document.body.append(panel);
  const controller = new AbortController(), { signal } = controller;
  const keys = new Set();
  let shockwavePending = false;
  let phase = 'opening', previous = 0, paused = false, disposed = false, dialog, battle, arena;
  function bounds() {
    if (!arena) {
      const box = presentation.getBounds();
      arena = Object.fromEntries(Object.entries(box).map(([key, value]) => [key, value / scale]));
      surface.style.top = `${box.top}px`;
    }
    return arena;
  }
  function labels() {
    arena = null;
    status.textContent = phase === 'opening' ? text('正在集结', 'Assembling') : phase === 'battle' ? text('星际生存', 'Space survival') : text('本局结束', 'Run complete');
    instructions.textContent = touch ? text('拖动移动 · 自动开火', 'Drag to move · Auto fire') : text('WASD / 方向键移动 · P 暂停 · Esc 结束', 'WASD / Arrows to move · P to pause · Esc to end');
    waveButton.textContent = text('冲击波', 'Shockwave');
    updateScore();
    battle?.resize(bounds());
  }
  function updateScore() {
    const waveText = `${text('冲击波', 'Shockwave')}: ${battle?.state.shockwaveCharges ?? 1} / 3 · ${touch ? text('橙色圆环补充', 'Orange rings refill') : text('空格释放 · 橙色圆环补充', 'Space to release · Orange rings refill')}`;
    if (shockwave.textContent !== waveText) shockwave.textContent = waveText;
    const disabled = phase !== 'battle' || paused || !battle?.state.shockwaveCharges;
    if (waveButton.disabled !== disabled) waveButton.disabled = disabled;
    const value = `${text('分数', 'Score')}: ${battle?.state.score ?? 0} · ${text('存活', 'Survived')}: ${(battle?.state.seconds ?? 0).toFixed(1)}s`;
    if (score.textContent !== value) score.textContent = value;
    const valueFeedback = battle?.state.pickupFeedback > 0 ? battle.state.pickupResults.map(result => describePickup(result, text)).join(' · ') : '';
    if (feedback.textContent !== valueFeedback) feedback.textContent = valueFeedback;
    if (feedback.hidden !== !valueFeedback) feedback.hidden = !valueFeedback;
  }
  const language = new MutationObserver(labels);
  language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  function canResume() { return presentation.graphics.available && !document.hidden && document.hasFocus() && innerWidth >= 280 && innerHeight >= 280; }
  function closeDialog() { dialog?.close(); dialog?.remove(); dialog = null; }
  function modal(title, detail, actions) {
    closeDialog();
    dialog = document.createElement('dialog'); dialog.className = 'game-modal'; dialog.setAttribute('translate', 'no');
    const heading = document.createElement('h2'); heading.id = 'game-state-title'; heading.textContent = title;
    dialog.setAttribute('aria-labelledby', heading.id);
    const description = document.createElement('p'); description.textContent = detail;
    dialog.append(heading, description);
    for (const [label, action] of actions) {
      const button = document.createElement('button'); button.textContent = label; button.onclick = action; dialog.append(button);
    }
    panel.append(dialog); dialog.showModal();
  }
  // Every lifecycle transition discards the old frame and input together. Keep the
  // battle paused while releasing its last pulse, before any resumed frame runs.
  function resetPlayback(suspended) {
    previous = 0;
    keys.clear(); shockwavePending = false; clearDrag(); activeTouches.clear();
    battle?.setPaused(true);
    battle?.advance(0);
    battle?.setPaused(suspended || phase !== 'battle');
    paused = suspended;
  }
  function beginBattle() {
    phase = 'battle';
    battle = createBattle({ bounds: bounds(), reducedMotion: reduced });
    resetPlayback(false);
    labels();
    gamePerformance.advance(0, bounds(), battle.state);
  }
  function returnHome() {
    if (!presentation.graphics.available) { leave(); return; }
    if (phase === 'returning' || disposed) return;
    gamePerformance.returnHome();
    phase = 'returning'; resetPlayback(false); closeDialog();
    controls.hidden = true; surface.hidden = true; hud.hidden = true;
    panel.focus({ preventScroll: true });
    presentation.graphics.redraw();
  }
  function finish() {
    if (!presentation.graphics.available) { leave(); return; }
    if (phase === 'returning') return;
    if (phase === 'opening') { returnHome(); return; }
    if (phase === 'results') return;
    phase = 'results'; resetPlayback(true);
    labels();
    showResults();
  }
  function showResults() {
    modal(text('本局结束', 'Run complete'), score.textContent, [
      [text('再来一局', 'Play again'), () => {
        if (!canResume()) return;
        closeDialog(); beginBattle(); panel.focus({ preventScroll: true });
        presentation.graphics.redraw();
      }],
      [text('返回首页', 'Return home'), returnHome],
    ]);
  }
  function draw(now) {
    if (paused || disposed) return;
    const dt = previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now;
    if (phase === 'returning') {
      if (gamePerformance.advance(dt, bounds()) === 'returned') { leave(); return; }
      return;
    }
    if (phase === 'opening') {
      if (gamePerformance.advance(dt, bounds()) === 'ready') beginBattle();
    } else if (phase === 'battle') {
      battle.advance(dt, {
        shockwave: shockwavePending,
        target,
        x: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')),
        y: Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')),
      });
      if (dt > 0) shockwavePending = false;
      updateScore();
      if (battle.state.ended) { gamePerformance.advance(dt, bounds(), battle.state); finish(); return; }
    }
    if (phase === 'battle') gamePerformance.advance(dt, bounds(), battle.state);
  }
  function resume() {
    if (!paused || phase === 'results' || !canResume()) return;
    closeDialog(); resetPlayback(false);
    battle?.resize(bounds());
    panel.focus({ preventScroll: true }); presentation.graphics.redraw();
  }
  function pause() {
    if (paused || disposed || phase === 'results' || phase === 'returning') return;
    resetPlayback(true);
    modal(text('游戏已暂停', 'Game paused'), text('准备好后，点击继续游戏。', 'Resume when you are ready.'), [
      [text('继续游戏', 'Resume game'), resume],
      [phase === 'opening' ? text('返回首页', 'Return home') : text('结束本局', 'End run'), finish],
    ]);
  }
  const unsubscribeGraphics = presentation.graphics.subscribe(status => {
    if (disposed) return;
    if (status === 'recovering') {
      resetPlayback(true); updateScore();
      modal(text('正在恢复图形', 'Restoring graphics'), text('游戏已暂停，请稍候。', 'The game is paused. Please wait.'), [
        [text('返回首页', 'Return home'), leave],
      ]);
    } else if (status === 'ready') {
      if (phase === 'results') { showResults(); return; }
      modal(text('游戏已暂停', 'Game paused'), text('图形已恢复，准备好后继续。', 'Graphics restored. Resume when you are ready.'), [
        [text('继续游戏', 'Resume game'), resume],
        [text('返回首页', 'Return home'), leave],
      ]);
    }
  });
  window.addEventListener('blur', pause, { signal });
  let viewportWidth = innerWidth;
  window.addEventListener('resize', () => {
    arena = null; clearDrag();
    const widthChanged = Math.abs(innerWidth - viewportWidth) > 2; viewportWidth = innerWidth;
    battle?.resize(bounds());
    if (!touch || widthChanged || !canResume()) pause();
    if (battle && (phase === 'battle' || phase === 'results')) gamePerformance.advance(0, bounds(), battle.state);
    presentation.graphics.redraw();
  }, { signal });
  screen.orientation?.addEventListener('change', pause, { signal });
  waveButton.addEventListener('click', () => { if (phase === 'battle' && !paused) shockwavePending = true; }, { signal });
  // Observe fingers on controls too: a second contact cancels the pending drag.
  panel.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    activeTouches.add(event.pointerId);
    if (activeTouches.size > 1) clearDrag();
  }, { signal, capture: true });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, event => {
    activeTouches.delete(event.pointerId);
  }, { signal });
  surface.addEventListener('pointerdown', event => {
    if (drag || activeTouches.size > 1 || event.button !== 0 || phase !== 'battle' || paused) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    target = { x: battle.state.ship.x, y: battle.state.ship.y };
    surface.setPointerCapture(event.pointerId);
  }, { signal });
  surface.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    target = constrainShipPosition({
      x: target.x + (event.clientX - drag.x) / scale,
      y: target.y + (event.clientY - drag.y) / scale,
    }, bounds());
    drag.x = event.clientX; drag.y = event.clientY;
  }, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, event => {
    if (drag?.id === event.pointerId) clearDrag();
  }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal });
  const movement = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  window.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (event.code === 'Space' && phase === 'battle' && !paused && !event.target.closest('button, a[href], input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
      event.preventDefault();
      if (!event.repeat) shockwavePending = true;
    }
    if (key === 'p') { event.preventDefault(); if (!event.repeat) pause(); }
    if (movement.has(key) && phase === 'battle' && !paused) { event.preventDefault(); keys.add(key); }
  }, { signal });
  window.addEventListener('keyup', event => { keys.delete(event.key.toLowerCase()); }, { signal });
  labels(); gamePerformance.advance(0, bounds()); panel.focus({ preventScroll: true }); presentation.graphics.redraw();
  return {
    escape() { if (phase === 'results') returnHome(); else finish(); },
    dispose() {
      disposed = true; unsubscribeGraphics(); resetPlayback(true); controller.abort(); language.disconnect();
      closeDialog(); gamePerformance.dispose(); panel.remove();
    },
  };
}
