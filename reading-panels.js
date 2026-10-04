import { readingPanels } from './reading-panel-content.js';

// Non-modal reading regions share routing but retain their own scroll and opener.
export function mountReadingPanels(container) {
  const home = document.querySelector('nav a[href="#"]');
  const about = document.querySelector('nav a[href="#about"]');
  const work = document.querySelector('nav a[href="#work"]');
  const panels = new Map();
  for (const [id, definition] of Object.entries(readingPanels)) {
    const panel = document.createElement('aside');
    panel.className = 'reading-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', `${id}-panel-title`);
    panel.hidden = true;
    panel.innerHTML = `<header class="reading-panel-header">
      <h2 id="${id}-panel-title" tabindex="-1">${definition.title}</h2>
      <a href="#" aria-label="关闭${definition.title}" class="reading-panel-close">关闭 ×</a>
    </header><div class="reading-panel-body">${definition.content}</div>`;
    container.append(panel);
    panels.set(`#${id}`, { route: `#${id}`, panel, title: panel.querySelector('h2'), close: panel.querySelector('.reading-panel-close'), opener: null });
  }
  let active, homeRequested = false;
  function owner(element) {
    return [...panels.entries()].find(([, entry]) => entry.panel.contains(element));
  }
  function fallback(route) {
    return document.querySelector(`nav a[href="${route}"]`) || document.querySelector(`.world-label[href="${route}"]`) || home;
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    if (link === home) homeRequested = true;
    if (link.classList.contains('reading-panel-close')) return;
    const route = link.getAttribute('href');
    const entry = panels.get(route);
    if (!entry) return;
    const focused = document.activeElement;
    entry.opener = focused?.matches('a') && focused.getAttribute('href') === route ? focused : link;
    entry.close.setAttribute('href', owner(entry.opener)?.[0] || '#');
    if (entry === active) entry.title.focus({ preventScroll: true });
  });
  function sync() {
    const next = panels.get(location.hash);
    const previous = active;
    for (const entry of panels.values()) entry.panel.hidden = entry !== next;
    for (const [link, current] of [[home, !location.hash], [about, location.hash === '#about' || location.hash === '#career'], [work, location.hash === '#work' || location.hash.startsWith('#work/')]]) {
      link.classList.toggle('is-current', current);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    active = next;
    if (next && next !== previous) {
      if (previous?.opener && next.panel.contains(previous.opener)) {
        previous.opener.focus({ preventScroll: true });
      } else {
        next.title.focus({ preventScroll: true });
      }
    } else if (!next && previous && !location.hash) {
      let target = homeRequested ? home : previous.opener;
      const visited = new Set();
      while (target && owner(target)) {
        const [, parent] = owner(target);
        if (visited.has(parent)) { target = home; break; }
        visited.add(parent);
        target = parent.opener;
      }
      (target?.isConnected ? target : fallback(previous.route)).focus({ preventScroll: true });
    }
    homeRequested = false;
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      location.hash = active.close.getAttribute('href').slice(1);
    }
  });
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  sync();
}
