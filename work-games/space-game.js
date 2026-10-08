import css from './space-game.css?inline';
import { mountOpening } from './opening.js';

export function startGame({ scene, world, leave, text }) {
  const panel = document.createElement('section');
  panel.className = 'space-game';
  const style = document.createElement('style'); style.textContent = css; panel.append(style);
  const hud = document.createElement('div'); hud.className = 'game-hud'; hud.setAttribute('translate', 'no');
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const instructions = document.createElement('p');
  const score = document.createElement('p');
  const back = document.createElement('button'); back.type = 'button'; back.onclick = () => leave();
  hud.append(status, instructions, score, back); panel.append(hud);
  const heading = scene.querySelector('.scene-heading');
  const captures = world.takeOver();
  heading.style.visibility = 'hidden';
  const opening = mountOpening(panel, captures, matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.body.append(panel);
  const controller = new AbortController(), { signal } = controller;
  let time = 0, orbit = 0, previous = 0, frame = 0, paused = false, disposed = false, dialog;
  function bounds() {
    return { left: 24, right: innerWidth - 24, top: Math.max(160, hud.getBoundingClientRect().bottom + 20), bottom: innerHeight - 20 };
  }
  function labels() {
    status.textContent = time < 3 ? text('正在集结', 'Assembling') : text('飞船已就位', 'Ship ready');
    instructions.textContent = text('WASD / 方向键移动 · P 暂停 · Esc 结束', 'WASD / Arrows to move · P to pause · Esc to end');
    score.textContent = text('分数：0', 'Score: 0');
    back.textContent = text('返回首页', 'Return home');
  }
  const language = new MutationObserver(labels);
  language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  labels();
  function draw(now) {
    frame = 0;
    if (paused || disposed) return;
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now;
    if (time < 3) { time = Math.min(3, time + dt); if (time === 3) labels(); }
    else orbit += dt;
    opening.render(time, orbit, bounds());
    frame = requestAnimationFrame(draw);
  }
  function resume() {
    if (document.hidden || !document.hasFocus() || innerWidth < 800 || innerHeight < 600) return;
    dialog?.close(); dialog?.remove(); dialog = null;
    paused = false; previous = 0; back.focus({ preventScroll: true }); frame = requestAnimationFrame(draw);
  }
  function pause() {
    if (paused || disposed) return;
    paused = true; cancelAnimationFrame(frame); previous = 0;
    dialog = document.createElement('dialog'); dialog.className = 'game-modal';
    const title = document.createElement('h2'); title.id = 'game-pause-title'; title.textContent = text('游戏已暂停', 'Game paused');
    dialog.setAttribute('aria-labelledby', title.id);
    const hint = document.createElement('p'); hint.textContent = text('回到至少 800 × 600 的窗口后，手动继续。', 'Return to a window of at least 800 × 600, then resume.');
    const proceed = document.createElement('button'); proceed.textContent = text('继续游戏', 'Resume game'); proceed.onclick = resume;
    const exit = document.createElement('button'); exit.textContent = text('返回首页', 'Return home'); exit.onclick = () => leave();
    dialog.append(title, hint, proceed, exit); panel.append(dialog); dialog.showModal();
  }
  window.addEventListener('blur', pause, { signal });
  window.addEventListener('resize', pause, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal });
  window.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); pause(); }
  }, { signal });
  opening.render(0, 0, bounds()); back.focus({ preventScroll: true }); frame = requestAnimationFrame(draw);
  return {
    escape() { leave(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); controller.abort(); language.disconnect();
      dialog?.close(); panel.remove(); world.restore(); heading.style.visibility = '';
    },
  };
}
