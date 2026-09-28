import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Domain } from '../../content/life';
import { PALETTE, PaletteKey } from '../art/palette';

type Part = [THREE.BufferGeometry, PaletteKey];

const colour = new THREE.Color();

/** Merges coloured parts into one vertex-coloured geometry: one draw call, still plain (shatterable) triangles. */
function merge(parts: Part[]): THREE.BufferGeometry {
  const flat = parts.map(([g, key]) => {
    const f = (g.index ? g.toNonIndexed() : g.clone()).deleteAttribute('uv');
    f.deleteAttribute('normal');
    colour.set(PALETTE[key]);
    const count = f.getAttribute('position').count;
    const rgb = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colour.toArray(rgb, i * 3);
    f.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    g.dispose();
    return f;
  });
  const merged = mergeGeometries(flat);
  flat.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

/** A flat shape extruded `depth` m, centred on z. */
function slab(points: [number, number][], depth: number): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(
    new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))),
    {
      depth,
      bevelEnabled: false,
    },
  ).translate(0, 0, -depth / 2);
}

/** Thread spool and needle: tailoring. */
function spool(): Part[] {
  return [
    [new THREE.CylinderGeometry(0.34, 0.34, 0.9, 6), 'terracotta'],
    [new THREE.CylinderGeometry(0.58, 0.58, 0.14, 6).translate(0, 0.52, 0), 'brass'],
    [new THREE.CylinderGeometry(0.58, 0.58, 0.14, 6).translate(0, -0.52, 0), 'brass'],
    [
      new THREE.CylinderGeometry(0.035, 0.01, 1.7, 4).rotateZ(-0.9).translate(0.1, 0.05, 0.45),
      'chalk',
    ],
  ];
}

/** Mortarboard: online learning. */
function mortarboard(): Part[] {
  return [
    [
      new THREE.BoxGeometry(1.5, 0.1, 1.5)
        .rotateY(Math.PI / 4)
        .rotateX(0.35)
        .translate(0, 0.35, 0),
      'wheat',
    ],
    [new THREE.CylinderGeometry(0.5, 0.58, 0.55, 6).translate(0, -0.05, 0), 'brass'],
    [new THREE.BoxGeometry(0.05, 0.62, 0.05).translate(0.72, 0.0, 0.3), 'candle'],
    [new THREE.OctahedronGeometry(0.1).translate(0.72, -0.34, 0.3), 'candle'],
  ];
}

/** Serving cloche on a plate: restaurant management and delivery. */
function cloche(): Part[] {
  return [
    [
      new THREE.SphereGeometry(0.72, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, -0.3, 0),
      'chalk',
    ],
    [new THREE.CylinderGeometry(1, 0.9, 0.09, 8).translate(0, -0.35, 0), 'brass'],
    [new THREE.SphereGeometry(0.12, 6, 3).translate(0, 0.48, 0), 'brass'],
  ];
}

/** A heart: healthcare. (A plain heart, not a cross, which is a protected emblem.) */
function heart(): Part[] {
  const points: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * Math.PI * 2;
    points.push([
      0.05 * 16 * Math.sin(t) ** 3,
      0.05 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ]);
  }
  return [[slab(points, 0.34).translate(0, 0.05, 0), 'brick']];
}

/** A stack of coins and a bank card leaning on it: fintech. */
function coins(): Part[] {
  const coin = (y: number, x = 0) => new THREE.CylinderGeometry(0.42, 0.42, 0.16, 6).translate(x, y, 0);
  return [
    [coin(-0.62), 'brass'],
    [coin(-0.45), 'wheat'],
    [coin(-0.28), 'brass'],
    [coin(-0.11, 0.05), 'wheat'],
    [new THREE.BoxGeometry(0.95, 0.6, 0.05).rotateZ(-0.35).translate(-0.62, -0.25, 0.3), 'skyBlue'],
    [new THREE.BoxGeometry(0.95, 0.1, 0.06).rotateZ(-0.35).translate(-0.57, -0.1, 0.31), 'steel'],
  ];
}

/** A seedling with a sensor sending out signal arcs: IoT monitoring for growers. */
function seedling(): Part[] {
  const leaf = (side: number) =>
    new THREE.OctahedronGeometry(0.3)
      .scale(1.3, 0.45, 0.6)
      .rotateZ(side * 0.5)
      .translate(side * 0.34, 0.2, 0);
  const arc = (r: number) =>
    new THREE.TorusGeometry(r, 0.035, 3, 6, Math.PI / 2)
      .rotateZ(Math.PI / 4)
      .translate(0.55, 0.3, 0);
  return [
    [new THREE.CylinderGeometry(0.5, 0.62, 0.3, 6).translate(0, -0.55, 0), 'brick'],
    [new THREE.CylinderGeometry(0.04, 0.05, 0.8, 4).translate(0, -0.05, 0), 'krakowRoof'],
    [leaf(-1), 'krakowRoof'],
    [leaf(1), 'krakowRoof'],
    [new THREE.BoxGeometry(0.05, 0.8, 0.05).translate(0.55, -0.3, 0), 'steel'],
    [new THREE.BoxGeometry(0.18, 0.14, 0.12).translate(0.55, 0.14, 0), 'chalk'],
    [arc(0.25), 'screenGlow'],
    [arc(0.42), 'screenGlow'],
  ];
}

/** A cloud with a padlock: cloud data protection. */
function lockedCloud(): Part[] {
  return [
    [new THREE.IcosahedronGeometry(0.42).translate(-0.45, 0.2, -0.1), 'chalk'],
    [new THREE.IcosahedronGeometry(0.55).translate(0.05, 0.35, -0.15), 'chalk'],
    [new THREE.IcosahedronGeometry(0.4).translate(0.55, 0.15, -0.1), 'chalk'],
    [new THREE.BoxGeometry(0.6, 0.5, 0.2).translate(0.05, -0.28, 0.35), 'brass'],
    [new THREE.TorusGeometry(0.2, 0.05, 3, 8, Math.PI).translate(0.05, -0.03, 0.35), 'steel'],
  ];
}

/** A low-poly airliner seen side-on and a little from above: aviation. */
function airliner(): Part[] {
  const wing = slab(
    [
      [0.25, 0],
      [-0.3, 0.95],
      [-0.5, 0.95],
      [-0.3, 0],
    ],
    0.05,
  ).rotateX(Math.PI / 2);
  return [
    [new THREE.CylinderGeometry(0.16, 0.12, 1.7, 6).rotateZ(Math.PI / 2), 'chalk'],
    [new THREE.ConeGeometry(0.16, 0.36, 6).rotateZ(-Math.PI / 2).translate(1.03, 0, 0), 'chalk'],
    [wing.clone().translate(0, -0.02, 0), 'steel'],
    [wing.clone().scale(1, 1, -1).translate(0, -0.02, 0), 'steel'],
    [
      slab(
        [
          [-0.62, 0.05],
          [-0.9, 0.6],
          [-1.02, 0.6],
          [-0.85, 0.05],
        ],
        0.05,
      ),
      'skyBlue',
    ],
    [new THREE.BoxGeometry(0.28, 0.03, 0.7).translate(-0.8, 0.05, 0), 'steel'],
  ].map(([g, k]) => [(g as THREE.BufferGeometry).rotateY(-0.5).rotateX(0.25), k as PaletteKey]);
}

const BUILDERS: Record<Domain, () => Part[]> = {
  tailoring: spool,
  edtech: mortarboard,
  restaurants: cloche,
  healthcare: heart,
  iot: seedling,
  'data-protection': lockedCloud,
  aviation: airliner,
  fintech: coins,
};

/** A domain's emblem, about 1.6 m across, centred on its origin and facing +z. */
export function emblemGeometry(domain: Domain): THREE.BufferGeometry {
  return merge(BUILDERS[domain]());
}
