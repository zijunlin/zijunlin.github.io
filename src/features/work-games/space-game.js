import css from './space-game.css?inline';
import { mountGamePerformance } from './game-performance.js';
import { createBattle } from './battle.js';
import { mountBattleView } from './battle-view.js';

export function startGame({ presentation, leave, text }) {
  const panel = document.createElement('section'); panel.className = 'space-game'; panel.tabIndex = -1;
  panel.style.setProperty('--game-hud-top', presentation.hudTop);
  const style = document.createElement('style'); style.textContent = css; panel.append(style);
  const hud = document.createElement('div'); hud.className = 'game-hud'; hud.setAttribute('translate', 'no');
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const instructions = document.createElement('p'), score = document.createElement('p');
  score.className = 'game-score';
  const weapon = document.createElement('p'); weapon.className = 'game-weapon'; weapon.setAttribute('role', 'status');
  const shockwave = document.createElement('p'); shockwave.className = 'game-shockwave';
  const back = document.createElement('button'); back.type = 'button';
  hud.append(status, instructions, score, weapon, shockwave, back); panel.append(hud);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gamePerformance = mountGamePerformance({ layer: panel, presentation, reduced });
  const view = mountBattleView(panel);
  document.body.append(panel);
  const controller = new AbortController(), { signal } = controller;
  const keys = new Set();
  let shockwavePending = false;
  let phase = 'opening', previous = 0, frame = 0, paused = false, disposed = false, dialog, battle, arena;
  function bounds() {
    return arena ??= { left: 24, right: innerWidth - 24, top: Math.max(160, hud.getBoundingClientRect().bottom + 20), bottom: innerHeight - 20 };
  }
  function labels() {
    arena = null;
    status.textContent = phase === 'opening' ? text('正在集结', 'Assembling') : phase === 'battle' ? text('星际生存', 'Space survival') : text('本局结束', 'Run complete');
    instructions.textContent = text('WASD / 方向键移动 · P 暂停 · Esc 结束', 'WASD / Arrows to move · P to pause · Esc to end');
    updateScore();
    back.textContent = text('返回首页', 'Return home');
    back.hidden = phase !== 'opening';
    battle?.resize(bounds());
  }
  function updateScore() {
    shockwave.textContent = `${text('冲击波', 'Shockwave')}: ${battle?.state.shockwaveCharges ?? 1} / 3 · ${text('空格释放 · 橙色圆环补充', 'Space to release · Orange rings refill')}`;
    const value = `${text('分数', 'Score')}: ${battle?.state.score ?? 0} · ${text('存活', 'Survived')}: ${(battle?.state.seconds ?? 0).toFixed(1)}s`;
    if (score.textContent !== value) score.textContent = value;
    const weaponValue = `${text('武器等级', 'Weapon level')}: ${battle?.state.weaponLevel ?? 0}${battle?.state.weaponLevel === 4 ? text(' · 满级', ' · Maximum') : ''}${battle?.state.weaponLevel >= 3 ? text(' · 穿透 2 个目标', ' · Piercing 2 targets') : ''}${battle?.state.pickupFeedback > 0 && battle?.state.pickupScore > 0 ? ` · +${battle.state.pickupScore} ${text('分', 'points')}` : ''}${battle?.state.pickupFeedback > 0 && battle?.state.pickupKind === 'weapon' ? text(' · 已拾取武器资源', ' · Weapon resource collected') : ''}`;
    if (weapon.textContent !== weaponValue) weapon.textContent = weaponValue;
  }
  const language = new MutationObserver(labels);
  language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  function canResume() { return !document.hidden && document.hasFocus() && innerWidth >= 800 && innerHeight >= 600; }
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
  function beginBattle() {
    phase = 'battle'; keys.clear(); shockwavePending = false; paused = false; previous = 0;
    battle = createBattle({ bounds: bounds(), reducedMotion: reduced });
    labels();
    gamePerformance.advance(0, bounds(), battle.state);
    view.draw(battle.state, bounds());
  }
  function returnHome() {
    if (phase === 'returning' || disposed) return;
    gamePerformance.returnHome();
    phase = 'returning'; paused = false; previous = 0;
    keys.clear(); shockwavePending = false; battle?.setPaused(true); closeDialog();
    hud.hidden = true; panel.querySelector('.game-effects').hidden = true;
    panel.focus({ preventScroll: true });
    cancelAnimationFrame(frame); frame = requestAnimationFrame(draw);
  }
  function finish() {
    if (phase === 'returning') return;
    if (phase === 'opening') { returnHome(); return; }
    if (phase === 'results') return;
    phase = 'results'; paused = true; battle.setPaused(true); keys.clear(); shockwavePending = false; cancelAnimationFrame(frame); previous = 0;
    labels();
    modal(text('本局结束', 'Run complete'), score.textContent, [
      [text('再来一局', 'Play again'), () => {
        if (!canResume()) return;
        closeDialog(); beginBattle(); (phase === 'opening' ? back : panel).focus({ preventScroll: true });
        view.resize(); frame = requestAnimationFrame(draw);
      }],
      [text('返回首页', 'Return home'), returnHome],
    ]);
  }
  back.onclick = finish;
  function draw(now) {
    frame = 0;
    if (paused || disposed) return;
    const dt = previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now;
    if (phase === 'returning') {
      if (gamePerformance.advance(dt, bounds()) === 'returned') { leave(); return; }
      frame = requestAnimationFrame(draw); return;
    }
    if (phase === 'opening') {
      if (gamePerformance.advance(dt, bounds()) === 'ready') beginBattle();
    } else if (phase === 'battle') {
      battle.advance(dt, {
        shockwave: shockwavePending,
        x: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')),
        y: Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')),
      });
      if (dt > 0) shockwavePending = false;
      updateScore(); view.draw(battle.state, bounds());
      if (battle.state.ended) { finish(); return; }
    }
    if (phase === 'battle') gamePerformance.advance(0, bounds(), battle.state);
    frame = requestAnimationFrame(draw);
  }
  function resume() {
    if (!paused || phase === 'results' || !canResume()) return;
    closeDialog(); paused = false; previous = 0; keys.clear(); shockwavePending = false;
    // The page sends pulses; release the previous pulse before accepting fresh input.
    battle?.advance(0);
    battle?.resize(bounds()); battle?.setPaused(false); view.resize();
    (phase === 'opening' ? back : panel).focus({ preventScroll: true }); frame = requestAnimationFrame(draw);
  }
  function pause() {
    keys.clear(); shockwavePending = false;
    if (paused || disposed || phase === 'results' || phase === 'returning') return;
    paused = true; battle?.setPaused(true); cancelAnimationFrame(frame); previous = 0;
    modal(text('游戏已暂停', 'Game paused'), text('回到至少 800 × 600 的窗口后，手动继续。', 'Return to a window of at least 800 × 600, then resume.'), [
      [text('继续游戏', 'Resume game'), resume],
      [phase === 'opening' ? text('返回首页', 'Return home') : text('结束本局', 'End run'), finish],
    ]);
  }
  window.addEventListener('blur', pause, { signal });
  window.addEventListener('resize', () => { arena = null; pause(); }, { signal });
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
  labels(); gamePerformance.advance(0, bounds()); (phase === 'opening' ? back : panel).focus({ preventScroll: true }); frame = requestAnimationFrame(draw);
  return {
    escape() { if (phase === 'results') returnHome(); else finish(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); controller.abort(); language.disconnect(); keys.clear(); shockwavePending = false;
      closeDialog(); gamePerformance.dispose(); panel.remove();
    },
  };
}
