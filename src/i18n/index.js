import { english } from './locales/en.js';

// Respect the order of browser preferences, using English if none is supported.
export function resolveLanguage(languages = []) {
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (base === 'zh') return 'zh-CN';
    if (base === 'en') return 'en';
  }
  return 'en';
}

const preferenceKey = 'site-language';
function savedLanguage() {
  try {
    const saved = globalThis.localStorage?.getItem(preferenceKey);
    return ['zh-CN', 'en'].includes(saved) ? saved : null;
  } catch { return null; }
}

export let language = savedLanguage() || resolveLanguage(
  globalThis.navigator?.languages?.length ? navigator.languages : [globalThis.navigator?.language || 'en'],
);

export function translate(value) {
  if (language !== 'en') return value;
  const source = value.trim();
  return Object.hasOwn(english, source) ? value.replace(source, () => english[source]) : value;
}

const sourceText = new WeakMap();
const sourceAttributes = new WeakMap();

// Translate text nodes and accessible labels, leaving markup, URLs and listeners intact.
// Keep original Chinese copy so switching can update mounted regions in place.
export function localize(root) {
  const document = root.ownerDocument || root;
  const walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script, style, [translate="no"]')) continue;
    if (!sourceText.has(node)) sourceText.set(node, node.nodeValue);
    node.nodeValue = translate(sourceText.get(node));
  }
  const elements = [...root.querySelectorAll('[aria-label], [title], meta[name="description"]')];
  if (root.nodeType === 1) elements.push(root);
  for (const element of elements) {
    for (const attribute of ['aria-label', 'title', ...(element.matches('meta[name="description"]') ? ['content'] : [])]) {
      if (!element.hasAttribute(attribute)) continue;
      if (!sourceAttributes.has(element)) sourceAttributes.set(element, new Map());
      const original = sourceAttributes.get(element);
      if (!original.has(attribute)) original.set(attribute, element.getAttribute(attribute));
      element.setAttribute(attribute, translate(original.get(attribute)));
    }
  }
}

function updateDocument() {
  document.documentElement.lang = language;
  localize(document);
  for (const button of document.querySelectorAll('[data-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  }
}

export function setLanguage(next) {
  if (!['zh-CN', 'en'].includes(next)) return;
  language = next;
  try { localStorage.setItem(preferenceKey, next); } catch { /* Switching still works without storage. */ }
  updateDocument();
}

if (typeof document !== 'undefined') {
  updateDocument();
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-language]');
    if (button) setLanguage(button.dataset.language);
  });
}

