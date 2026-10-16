// The hull and its soft glow consume the same geometry without copying nodes.
export const shipAppearance = {
  width: 26.4, height: 39.6, viewBox: [-24, -30, 48, 72], glowColor: '#8de9f0',
  polygons: [
    { color: '#a7e9ed', points: [[0,-26], [19,19], [7,13], [0,19], [-7,13], [-19,19]] },
    { color: '#163a49', points: [[0,-13], [6,9], [0,5], [-6,9]] },
    { color: '#e5ffff', points: [[-2,-6], [2,-6], [2,3], [-2,3]] },
    { color: '#8de9f080', points: [[-5,18], [0,34], [5,18]] },
  ],
};
