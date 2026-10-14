import { localize } from '../../i18n/index.js';
// Keep visual assets within the world initialization boundary.
export async function mountWorld(container, state) {
  const heading = document.createElement('div');
  heading.className = 'scene-heading';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = '架构设计 · 全栈工程 · AI 探索';
  const title = document.createElement('h1');
  title.textContent = '在构建中，保持好奇。';
  const combination = document.createElement('div');
  combination.className = 'world-combination';
  combination.setAttribute('role', 'group');
  combination.setAttribute('aria-label', '世界形态与空间布局');
  const worldName = '软件工程';
  const layoutName = state.layout === 'A' ? '持续探索' : '成长路径';
  combination.textContent = `${worldName} · ${layoutName}`;
  const metadata = document.createElement('div'); metadata.className = 'world-metadata';
  const shortcut = document.createElement('span'); shortcut.className = 'world-game-shortcut';
  shortcut.textContent = matchMedia('(any-pointer: coarse)').matches ? '三击一下' : 'Shift+G';
  metadata.append(combination, shortcut);
  heading.append(eyebrow, title, metadata);
  localize(heading);
  container.replaceChildren(heading);
  const { mountWorldView } = await import('./world-view.js');
  return mountWorldView(container, state);
}
