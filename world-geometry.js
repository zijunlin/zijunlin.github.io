import { Group, Mesh, MeshStandardMaterial, CylinderGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3, Vector3 } from 'three';

// Approved C objects and A/B placement from the visual integration study.
const regions = [
  { id: 'about', label: '关于我' },
  { id: 'career', label: '职业历程' },
  { id: 'work', label: '作品集' },
  { id: 'notes', label: '随笔' },
];
const layouts = {
  A: {
    about: { x: -100, z: -62, labelX: 160, labelY: 126 },
    career: { x: -60, z: 100, labelX: 113, labelY: 341 },
    work: { x: 8, z: 5, labelX: 397, labelY: 249 },
    notes: { x: 65, z: -100, labelX: 499, labelY: 208 },
  },
  B: {
    about: { x: -125, z: 20, labelX: 122, labelY: 164 },
    career: { x: -50, z: 15, labelX: 202, labelY: 277 },
    work: { x: 30, z: -20, labelX: 465, labelY: 192 },
    notes: { x: 112, z: -15, labelX: 484, labelY: 323 },
  },
};

export function buildWorldGeometry(scene, { world, layout }) {
  const materials = new Map();
  let parent = scene;
  function material(color) {
    const key = `${parent.uuid}:${color}`;
    if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({ color, roughness: world === 'system' ? 0.55 : 0.9, metalness: world === 'system' ? 0.12 : 0 }));
    return materials.get(key);
  }
  function add(geometry, color, x, y, z) {
    const mesh = new Mesh(geometry, material(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function drum(x, z, bottom, radius, height, color) {
    return add(new CylinderGeometry(radius, radius, height, 64), color, x, bottom + height / 2, z);
  }
  function ring(x, z, height, radius, thickness, color) {
    const mesh = add(new TorusGeometry(radius, thickness, 8, 64), color, x, height, z);
    mesh.rotation.x = -Math.PI / 2;
  }
  if (world === 'island') {
    drum(0, 0, -36, 147, 14, '#273c46');
    drum(0, 0, -22, 137, 12, '#344a52');
    drum(0, 0, -10, 123, 10, '#4b6063');
  } else {
    // Separated graphite discs replace the island's continuous terraces.
    drum(0, 0, -30, 147, 3, '#1c2f3a');
    drum(0, 0, -16, 137, 3, '#243b49');
    drum(0, 0, -2, 123, 2, '#142731');
    ring(0, 0, 0, 123, 1.2, '#809b9f');
  }

  const placed = regions.map(region => ({ ...region, ...layouts[layout][region.id] }));
  // A closes around the central workshop; B joins the four regions in order.
  const pathPoints = layout === 'A'
    ? [[-100, -62], [10, -105], [65, -100], [110, 20], [-60, 100], [-115, 35]]
    : placed.map(({ x, z }) => [x, z]);
  const path = new CatmullRomCurve3(pathPoints.map(([x, z]) => new Vector3(x, 2, z)), layout === 'A', 'centripetal');
  add(new TubeGeometry(path, 96, world === 'island' ? 1.5 : 0.8, 8, layout === 'A'), world === 'island' ? '#82958c' : '#6c919e', 0, 0, 0);

  const objects = world === 'island' ? islandObjects : systemObjects;
  for (const region of placed) {
    parent = new Group();
    scene.add(parent);
    region.object = parent;
    objects[region.id](region.x, region.z, { drum, ring });
  }
  return placed;
}

const islandObjects = {
  about(x, z, { drum, ring }) {
    drum(x, z, 0, 24, 12, '#798b8e');
    drum(x, z, 12, 17, 39, '#bcc5c1');
    drum(x, z, 51, 20, 3, '#d2d6cc');
    ring(x, z, 56, 9, 1, '#d4ac70');
  },
  work(x, z, { drum, ring }) {
    drum(x, z, 0, 42, 10, '#74878a');
    drum(x, z, 12, 34, 17, '#bcc5c1');
    drum(x, z, 32, 25, 16, '#dedfd3');
    drum(x, z, 48, 17, 1, '#334950');
    ring(x, z, 50, 11, 2, '#bda574');
  },
  career(x, z, { drum, ring }) {
    ring(x, z, 4, 34, 3.5, '#798b8e');
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI / 2.5;
      drum(x + Math.cos(angle) * 34, z + Math.sin(angle) * 34, 4, 3, 4, '#cfaa73');
    }
  },
  notes(x, z, { drum, ring }) {
    drum(x, z, 0, 26, 6, '#687c79');
    drum(x, z, 6, 19, 0.5, '#334b46');
    ring(x, z, 7, 19, 1.5, '#94a39a');
    ring(x, z, 9, 10, 0.5, '#798b8e');
  },
};

const systemObjects = {
  about(x, z, { drum, ring }) {
    // An open identity node, not the dwelling's enclosed cylinder and roof.
    drum(x, z, 0, 24, 3, '#334c58');
    drum(x, z, 3, 4, 46, '#526d78');
    ring(x, z, 12, 20, 2.5, '#ccd8d5');
    ring(x, z, 40, 17, 2.3, '#ccd8d5');
    ring(x, z, 54, 9, 1, '#d4ac70');
  },
  career(x, z, { drum, ring }) {
    // Concentric traces and discrete amber contacts form the time bus.
    ring(x, z, 4, 34, 1.5, '#b9ccce');
    ring(x, z, 4, 28, 1, '#587c8b');
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI / 2.5;
      drum(x + Math.cos(angle) * 34, z + Math.sin(angle) * 34, 4, 3, 2, '#cfaa73');
    }
  },
  work(x, z, { drum, ring }) {
    // Thin ceramic modules float around one axis, separated by open gaps.
    drum(x, z, 0, 42, 4, '#334c58');
    drum(x, z, 4, 6, 46, '#a6bfc3');
    drum(x, z, 14, 34, 3, '#d1dcd9');
    drum(x, z, 30, 25, 4, '#e0e7de');
    ring(x, z, 45, 17, 2.4, '#78949c');
    ring(x, z, 54, 11, 1.5, '#d4ac70');
  },
  notes(x, z, { drum, ring }) {
    // Empty rings reserve an experiment area without inventing content.
    drum(x, z, 0, 26, 3, '#263e49');
    ring(x, z, 8, 19, 1.5, '#9bb4ba');
    ring(x, z, 11, 10, 0.7, '#688994');
  },
};
