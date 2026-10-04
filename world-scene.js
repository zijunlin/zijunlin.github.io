// World objects and the protagonist are added in their own implementation
// tickets. Keep their future asset readiness inside this initialization boundary.
export function mountWorld(container) {
  const heading = document.createElement('div');
  heading.className = 'scene-heading';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = '架构设计 · 工程实践 · AI 探索';
  const title = document.createElement('h1');
  title.textContent = '在构建中，保持好奇。';
  heading.append(eyebrow, title);
  container.replaceChildren(heading);
}
