export const readingPanels = {
  notes: { title: '随笔', content: `
    <h3>还没有发布的随笔</h3>
    <p>这里将记录技术思考、学习过程、创作体验与日常感悟。</p>
    <p>先从作品中了解我的工程实践。</p>
    <p><a href="#work">浏览作品</a></p>` },
  work: { title: '作品', content: `
    <p class="directory-intro">从实际项目中，观察架构与工程决策。</p>
    <ul class="work-directory">
      <li><details class="work-item">
        <summary>
          <span class="work-meta"><span class="work-featured">精选作品</span><time datetime="2019">2019</time></span>
          <span class="work-title">智能语音平台</span>
          <span class="work-tags"><span>架构设计</span><span>对话编排</span></span>
          <span class="work-description">将流转驱动与对话内容分离，通过可组合的 Action 支持业务扩展。</span>
        </summary>
        <a class="work-preview-link" href="#work/platform">查看作品预览 ↗</a>
      </details></li>
    </ul>` },
  about: { title: "关于我", content: `
      <h3>林子钧</h3>
      <p class="about-role">曾任阿里巴巴 P7 技术专家</p>
      <p><a href="#career">查看职业历程 →</a></p>
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
    ` },
  career: { title: '职业历程', content: `
    <p class="timeline-intro">从移动端到平台建设，再到 AI 探索。</p>
    <ol class="career-timeline">
      <li><time datetime="2013">2013</time><h3>来往</h3><p>负责 Android 客户端开发，投身移动互联网。</p></li>
      <li><time datetime="2016">2016</time><h3>点点虫</h3><p>负责视频 App 开发，同时轮岗后端，拓展全栈实践。</p></li>
      <li><time datetime="2017">2017</time><h3>菜鸟 · 裹裹</h3><p>负责裹裹 App 客户端开发。</p></li>
      <li><time datetime="2019">2019</time><h3>智能语音平台</h3><p>负责平台建设、整体架构与核心系统研发。</p><a href="#work/platform">查看关联作品：智能语音平台 ↗</a></li>
      <li><time datetime="2026">2026</time><h3>AI 探索</h3><p>关注大模型能力如何融入真实业务，持续探索 AI 工程与产品。</p></li>
    </ol>` },
};
