import css from './space-game.css?inline';
export function startGame({ leave, text }) {
  const panel = document.createElement('section');
  panel.className = 'space-game';
  const style = document.createElement('style'); style.textContent = css; panel.append(style);
  const heading = document.createElement('h2');
  heading.textContent = text('游戏已就绪', 'Game ready');
  const button = document.createElement('button');
  button.textContent = text('返回首页', 'Return home');
  button.onclick = () => leave();
  panel.append(heading, button); document.body.append(panel); button.focus();
  return { dispose() { panel.remove(); }, escape() { leave(); } };
}
