// Shared by home orbs and game satellites; compiled into their radial shader.
export const ORB_HALO_STOPS = [[0, 1], [.45, .55], [1, 0]];

// Geometry and appearance are renderer-independent values in a 200-unit square.
export function createOrbAppearance(index) {
  return {
    color: '#a2d9df', size: 200, discRadius: 35.7, discOpacity: .2275,
    haloRadius: 125, haloOpacity: .65,
    pulseDelay: -index * 1700,
    particles: Array.from({ length: 36 }, (_, i) => {
      const angle = Math.random() * 360;
      const radius = Math.sqrt(38 ** 2 + Math.random() * (100 ** 2 - 38 ** 2));
      const infalling = i % 8 === 0 || i >= 32;
      const duration = (infalling ? 2.8 + (i % 9) * .3 : 10 + (i % 9) * .7) * 1000;
      return { angle, radius, infalling, duration, delay: -duration * ((i * .618034) % 1), size: 1.8 + (i % 5) * .35 };
    }),
  };
}

export const orbScale = expanded => expanded ? .4935 : .378;

// During return, geometry and the interaction envelope meet the current home
// target; the frozen pulse and particle phase retain their original appearance.
export function returningOrbAppearance(from, to, progress) {
  const mix = (a, b) => a + (b - a) * progress;
  return { ...from, pose: { ...from.pose,
    scale: mix(from.pose.scale, to.pose.scale),
    translateX: mix(from.pose.translateX, to.pose.translateX),
    particlesOpacity: mix(from.pose.particlesOpacity, to.pose.particlesOpacity),
  } };
}
