// Prepare site artwork once; the game owns its placement and animation clock.
export function prepareHomeGame(scene, world) {
  const heading = scene.querySelector('.scene-heading');
  const visibility = heading.style.visibility;
  const captures = world.takeOver();
  heading.style.visibility = 'hidden';
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    world.restore();
    heading.style.visibility = visibility;
  };
  try {
    const satellites = captures.map(capture => {
      const { art } = capture;
      art.style.width = '100%'; art.style.height = 'auto';
      art.style.transformOrigin = '50% 50%';
      const svg = art.querySelector('svg');
      svg.style.width = '100%'; svg.style.height = 'auto';
      const halo = art.querySelector('.orb-halo');
      const envelope = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      halo.before(envelope); envelope.append(halo);
      return {
        ...capture,
        setEnvelopeScale(scale) {
          envelope.setAttribute('transform', `translate(100 100) scale(${scale}) translate(-100 -100)`);
        },
      };
    });
    return {
      satellites,
      hudTop: 'calc(var(--header-height) + 10px)',
      returnTargets: () => world.returnTargets(),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
