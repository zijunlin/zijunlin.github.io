// About is a non-modal reading region: navigation and world entrances remain usable.
export function mountAboutPanel(container) {
  const panel = document.createElement('aside');
  panel.className = 'reading-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'about-panel-title');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="reading-panel-header">
      <h2 id="about-panel-title" tabindex="-1">关于我</h2>
      <a href="#" aria-label="关闭关于我" class="reading-panel-close">关闭 ×</a>
    </header>
    <div class="reading-panel-body">
      <h3>林子钧</h3>
      <p class="about-role">曾任阿里巴巴 P7 技术专家</p>
      <p>拥有十余年阿里巴巴研发经验，长期扎根一线开发，持续从事核心系统研发与架构设计。从移动端到服务端与平台建设，经历移动互联网、云原生与 AI 时代的技术演进，在实践中不断拓展技术视野。</p>
      <p>擅长从业务出发，将复杂问题抽象为职责清晰、边界明确的软件系统。在架构设计中，关注核心业务与基础设施的分离，以及通用能力与差异化需求之间的平衡，让系统既能解决当下的问题，也能适应长期变化。</p>
      <p>曾主导智能语音平台的整体架构、核心系统设计与关键研发，推动对话沟通引擎升级，并通过渐进式迁移完成数百个客户的切换。这段经历让我持续思考：如何在业务运行与增长的过程中，让系统保持可靠，并不断演进。</p>
      <p>热爱亲手构建，也享受深入问题、专注创造时的心流。重视清晰的命名、高质量的代码与有效的协作，坚持对系统从设计、实现到运行的结果负责。</p>
      <h3>关注方向</h3>
      <ul>
        <li><strong>AI Native 应用</strong>：探索以 AI 能力为基础的产品形态与交互方式。</li>
        <li><strong>LLM 工程化</strong>：关注大模型能力如何融入真实业务，形成可靠、可维护的应用。</li>
        <li><strong>智能语音系统</strong>：关注语音交互、对话编排与业务流程的结合。</li>
        <li><strong>分布式系统</strong>：关注系统可靠性、可观测性与持续演进。</li>
        <li><strong>平台架构设计</strong>：通过清晰的职责划分与扩展边界，支撑业务多样性。</li>
      </ul>
      <p>欢迎围绕系统架构、AI 工程与产品合作交流。</p>
      <div class="about-contacts">
        <a href="mailto:linzijun.programmer@gmail.com">邮箱 ↗</a>
        <a href="https://github.com/zijunlin" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        <a href="https://www.linkedin.com/in/子钧-林-441281a2" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
      </div>
    </div>`;
  container.append(panel);
  const title = panel.querySelector('h2');
  const home = document.querySelector('nav a[href="#"]');
  const about = document.querySelector('nav a[href="#about"]');
  let returnFocus = about;
  document.addEventListener('click', event => {
    if (event.target.closest('a') === home) returnFocus = home;
    const link = event.target.closest('a[href="#about"]');
    if (!link) return;
    // Object targets focus their semantic label before this delegated handler runs.
    returnFocus = document.activeElement?.matches('a[href="#about"]') ? document.activeElement : link;
    if (!panel.hidden) title.focus({ preventScroll: true });
  });
  function sync() {
    const open = location.hash === '#about';
    const wasOpen = !panel.hidden;
    panel.hidden = !open;
    for (const [link, current] of [[home, !location.hash], [about, open]]) {
      link.classList.toggle('is-current', current);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (open && !wasOpen) {
      panel.querySelector('.reading-panel-body').scrollTop = 0;
      title.focus({ preventScroll: true });
    } else if (!open && wasOpen && !location.hash) {
      (returnFocus.isConnected ? returnFocus : about).focus({ preventScroll: true });
    }
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      location.hash = '';
    }
  });
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  sync();
}
