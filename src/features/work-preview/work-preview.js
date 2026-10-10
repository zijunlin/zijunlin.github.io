import { platformPreview } from '../../content/works/platform.js';
import { localize } from '../../i18n/index.js';
import { readingRoute } from '../../navigation/content-route.js';

// The preview is a separate popup layer; the world and reading panels stay mounted.
export function mountWorkPreview() {
  const route = '#work/platform';
  const dialog = document.createElement('dialog');
  dialog.className = 'work-preview';
  dialog.setAttribute('aria-labelledby', 'work-preview-title');
  dialog.innerHTML = platformPreview;
  localize(dialog);
  document.body.append(dialog);
  let opener;
  let source;
  function replaceRoute(hash) {
    const oldURL = location.href;
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: location.href }));
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#work/platform"]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash === route) return;
    opener = link;
    const oldURL = location.href;
    history.pushState({ workPreview: { source: location.hash } }, '', route);
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: location.href }));
  });
  function close() {
    if (location.hash !== route) return;
    if (history.state?.workPreview) history.back();
    else replaceRoute('');
  }
  dialog.querySelector('.preview-close').addEventListener('click', close);
  dialog.querySelector('.preview-return').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  function sync() {
    if (location.hash === route) {
      source = readingRoute();
      if (!dialog.open) dialog.showModal();
    } else {
      const wasOpen = dialog.open;
      dialog.close();
      if (wasOpen) {
        const sourcePanel = source ? document.getElementById(`${source.slice(1)}-panel-title`)?.closest('aside') : null;
        const target = opener?.isConnected && !opener.closest('[hidden]') ? opener
          : sourcePanel?.querySelector('a[href="#work/platform"]') || document.querySelector('nav a[href="#"]');
        target.focus({ preventScroll: true });
      }
    }
  }
  window.addEventListener('hashchange', sync);
  sync();
}
