// Hand off scene values once; renderers own artwork and the game owns its clock.
export function prepareHomeGame(scene, world, graphics) {
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
  return {
    satellites: captures,
    graphics,
    hudTop: 'calc(var(--header-height) + 10px)',
    getBounds: () => ({ left: 0, right: innerWidth, top: document.querySelector('.site-header').getBoundingClientRect().bottom, bottom: innerHeight }),
    returnTargets: () => world.returnTargets(),
    dispose,
  };
}
