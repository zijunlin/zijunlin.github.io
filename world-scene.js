// World objects and the protagonist are added in their own implementation
// tickets. Keep their future asset readiness inside this initialization boundary.
export function mountWorld(container, state) {
  const heading = document.createElement('div');
  heading.className = 'scene-heading';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = '架构设计 · 工程实践 · AI 探索';
  const title = document.createElement('h1');
  title.textContent = '在构建中，保持好奇。';
  const combination = document.createElement('div');
  combination.className = 'world-combination';
  combination.setAttribute('role', 'group');
  combination.setAttribute('aria-label', '世界形态与空间布局');
  const worldName = state.world === 'island' ? '建筑地形小岛' : '抽象系统空间';
  const layoutName = state.layout === 'A' ? '环绕核心' : '成长路径';
  combination.textContent = `${worldName} · ${layoutName}`;
  heading.append(eyebrow, title, combination);
  container.replaceChildren(heading);
}
