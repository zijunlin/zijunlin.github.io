// Content access stays independent of the renderer and its resources.
export function mountWorldFallback(container, message = '当前浏览器暂时无法展示完整世界，你仍可浏览全部内容。') {
  const section = document.createElement('section');
  section.className = 'world-fallback';
  section.setAttribute('aria-labelledby', 'world-fallback-title');
  section.innerHTML = `
    <h2 id="world-fallback-title">继续浏览内容</h2>
    <p></p>
    <ul>
      <li><a href="#about">关于我</a></li>
      <li><a href="#work">作品</a></li>
      <li><a href="#notes">心得</a></li>
      <li><a href="#career">职业历程</a></li>
    </ul>
    <a class="fallback-featured" href="/platform.html" target="_blank" rel="noopener noreferrer">阅读智能语音平台案例 <span aria-hidden="true">↗</span></a>`;
  section.querySelector('p').textContent = message;
  container.append(section);
}
