// Move the composed layers, never the camera. Children (including the character
// slot and entrance targets) inherit exactly the same world displacement.
export function mountWorldParallax(world, background) {
  const readingRoutes = new Set(['#about', '#career', '#work', '#notes', '#work/platform']);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let focused = document.hasFocus(), present = true;
  window.addEventListener('blur', () => { focused = false; }, { signal });
  window.addEventListener('focus', () => { focused = true; }, { signal });
  window.addEventListener('pagehide', () => { present = false; }, { signal });
  window.addEventListener('pageshow', () => { present = true; focused = document.hasFocus(); }, { signal });
  function move(x, y) {
    world.style.translate = `${x * 4}px ${y * 4}px`;
    if (background) background.style.translate = `${x * 2}px ${y * 2}px`;
  }
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) move(0, 0); }, { signal });
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !focused || !present || document.hidden || reducedMotion.matches || readingRoutes.has(location.hash)) return;
    const x = event.clientX / innerWidth * 2 - 1;
    const y = event.clientY / innerHeight * 2 - 1;
    const length = Math.max(1, Math.hypot(x, y));
    move(x / length, y / length);
  }, { signal, capture: true });
  return () => { controller.abort(); move(0, 0); };
}
