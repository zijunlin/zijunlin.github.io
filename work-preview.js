// The preview is a separate popup layer; the world and reading panels stay mounted.
export function mountWorkPreview() {
  const route = '#work/platform';
  const dialog = document.createElement('dialog');
  dialog.className = 'work-preview';
  dialog.setAttribute('aria-labelledby', 'work-preview-title');
  dialog.innerHTML = `
    <button type="button" class="preview-close" aria-label="关闭作品预览">关闭 ×</button>
    <p class="eyebrow">精选作品 · 对话沟通引擎升级</p>
    <h2 id="work-preview-title">智能语音平台</h2>
    <div class="preview-structure" role="img" aria-label="对话沟通引擎结构示意">
      <span>对话内容<small>节点与业务编排</small></span><b aria-hidden="true">⇄</b>
      <span>流转驱动器<small>独立的流转机制</small></span><b aria-hidden="true">→</b>
      <span>Action<small>组合与定制扩展</small></span>
    </div>
    <p class="preview-summary">将流转驱动与对话内容分离，让运营能够组合节点与 Action 编排业务，并以双引擎并行、监控对比和渐进式流量切换完成数百个客户迁移。</p>
    <p class="preview-responsibility">个人职责：主导平台整体架构、核心系统设计与关键研发。</p>
    <ul class="preview-tags" aria-label="作品标签"><li>架构设计</li><li>对话编排</li><li>渐进迁移</li></ul>
    <div class="preview-actions"><button type="button" class="preview-return">返回浏览</button><a href="/platform.html" target="_blank" rel="noopener noreferrer">查看作品详情 ↗</a></div>`;
  document.body.append(dialog);
  let source = location.hash === route ? '' : location.hash;
  let opener;
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#work/platform"]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    source = location.hash === route ? source : location.hash;
    opener = link;
  });
  function close() { location.hash = source; }
  dialog.querySelector('.preview-close').addEventListener('click', close);
  dialog.querySelector('.preview-return').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  function sync() {
    if (location.hash === route) {
      if (!dialog.open) dialog.showModal();
    } else {
      const wasOpen = dialog.open;
      dialog.close();
      source = location.hash;
      if (wasOpen) {
        const target = opener?.isConnected && !opener.closest('[hidden]') ? opener : document.querySelector('nav a[href="#work"]');
        target.focus({ preventScroll: true });
      }
    }
  }
  window.addEventListener('hashchange', sync);
  sync();
}
