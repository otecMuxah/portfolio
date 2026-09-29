import * as THREE from 'three';
import { SceneKind } from '../content/life';
import { ChapterSpan } from '../journey/journey';
import {
  Tint,
  asDetail,
  bench,
  bollard,
  busShelter,
  bush,
  detailMesh,
  litterBin,
  merge,
  paint,
  paintedMaterial,
  place,
  poplar,
  rock,
  streetLamp,
  tree,
} from './art/details';
import { seeded, smoothstep } from './art/kit';
import { PALETTE } from './art/palette';
import { bakeAO } from './art/shading';
import { chapterAnchor } from './chapter-scene';
import { DRIVE } from './escape';
import { carFrom } from './path';

/**
 * The world around the set pieces (#71), so nothing floats in a void: a sky dome, the ground and its verges along the
 * road, distant silhouettes in the fog band, and roadside props, each of the place the road runs through.
 *
 * Eras, from the chapters: Soviet and Ukrainian Kharkiv (grey panel blocks and factory chimneys far off; concrete lamp
 * poles with a bracket arm, poplars, chestnuts and limes, cast-concrete urns, a concrete bus pavilion), the rally's
 * pine forest, Kraków (the Planty's black lantern posts, green slatted benches and chestnuts; low townhouse rows and
 * copper spires, the Kościuszko Mound), and Germany: Aschaffenburg at the Spessart's edge (beech and spruce hills,
 * slim steel lamps, bins on posts) and Frankfurt (mid-rise and tall blocks, plane trees, a glass shelter).
 *
 * Budget: one sky, a few ground segments and one merged props mesh per chapter, culled by the frustum; the silhouettes
 * are three instanced meshes per half of the journey, one half shown at a time. Props and silhouettes are detail: the
 * war's shatter never copies them, and those of the world built before it go out as it starts.
 */

type Era = 'kharkiv' | 'forest' | 'krakow' | 'war' | 'germany' | 'frankfurt';

const ERA: Partial<Record<SceneKind, Era>> = {
  rally: 'forest',
  krakow: 'krakow',
  war: 'war',
  ciklum: 'germany',
  iata: 'frankfurt',
};
const eraOf = (scene: SceneKind): Era => ERA[scene] ?? 'kharkiv';

/** The ground's tints per era: the open field, the ground under a chapter's plot, and the verge beside the road. */
const GROUND: Record<Era, { field: string; plot: string; verge: string }> = {
  kharkiv: { field: '#3c472f', plot: '#4b5236', verge: '#4d463c' },
  forest: { field: '#4d4a33', plot: '#6b5f43', verge: '#6b5f43' },
  krakow: { field: '#3e5532', plot: '#6e665a', verge: '#5d584f' },
  war: { field: '#25241f', plot: '#2b2723', verge: '#2b2723' },
  germany: { field: PALETTE.meadow, plot: '#557043', verge: '#5b5a53' },
  frankfurt: { field: '#44603a', plot: '#5f6166', verge: '#5b5a53' },
};

const UP = new THREE.Vector3(0, 1, 0);
/** Metres the world runs back behind the first chapter and on past the last. */
const BACK = 60;
const ON = 120;
/** Props further than this from the camera (m) are lost in the fog (scene-engine.ts): not drawn. */
const FOG_FAR = 90;
/** The ground sits this far under the road and the chapters' own grounds, clear of z-fighting at the fog's reach. */
const GROUND_Y = -0.05;
/**
 * Across the car's line (m, + to its right): the ground's columns. Fine where the plots and verges are (left), coarse
 * out in the fog. The road runs from -3.3 (the pavement's back) to 4.1 (the far lane's edge).
 */
const ACROSS = [
  -120, -80, -56, -42, -34, -28, -23, -19, -15.5, -12.5, -10, -8, -6.2, -4.7, -3.3, 0, 4.1, 5.4, 8, 14, 26, 50, 80,
];

/** A chapter's plot: its set piece stands within 12 m of its anchor (scene-contract.ts). */
const PLOT = 12;
/**
 * Kept clear per chapter, in its own space (scene-contract.ts): the car at its midpoint, and the road side toward the
 * camera (x ≥ 4, z ≥ 4), up to just past where the camera stands (z = 16), the stretch it frames.
 */
const CAR = new THREE.Box3(new THREE.Vector3(11, -Infinity, -0.5), new THREE.Vector3(13, Infinity, 4.5));
const ROAD_SIDE = new THREE.Box3(new THREE.Vector3(4, -Infinity, 4), new THREE.Vector3(Infinity, Infinity, 20));
/** No prop stands nearer the car's line than this (m, to its left): the pavement's back is at -3.3. */
const VERGE = -4.2;

/** A deterministic hash of two integers into [0, 1). */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** The car's line through the journey, in metres along it (straight on past either end), as road.ts lays it. */
class CarLine {
  readonly length: number;
  private readonly lengths: number[];

  constructor(private readonly path: THREE.CatmullRomCurve3) {
    this.length = path.getLength();
    this.lengths = path.getLengths();
  }

  /** Metres along the line at camera path parameter `t`. */
  at(t: number): number {
    const lengths = this.lengths;
    const x = Math.min(Math.max(t, 0), 1) * (lengths.length - 1);
    const i = Math.min(Math.floor(x), lengths.length - 2);
    return lengths[i] + (lengths[i + 1] - lengths[i]) * (x - i);
  }

  /** The point `s` m along, `across` m to its right, into `out`; its level heading and right into `heading`, `side`. */
  frame(s: number, across: number, out: THREE.Vector3, heading: THREE.Vector3, side: THREE.Vector3): THREE.Vector3 {
    const u = Math.min(Math.max(s / this.length, 0), 1);
    carFrom(this.path.getPointAt(u, out), out);
    this.path.getTangentAt(u, heading).setY(0).normalize();
    out.addScaledVector(heading, s - u * this.length);
    side.crossVectors(heading, UP).normalize();
    return out.addScaledVector(side, across).setY(0);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Sky.

/** The dome's rings, by elevation (degrees): the horizon is the fog, a faint glow just above it, dark overhead. */
const RINGS = [-8, 0, 2, 5, 9, 14, 22, 34, 50, 70, 90];
const SKY_RADIUS = 400;
/** Night: the fog colour at the horizon, a city's glow just above it, and a darker zenith. Dawn: the same, lifting. */
const SKY = {
  night: { glow: new THREE.Color('#1c1b22'), zenith: new THREE.Color('#06070b') },
  dawn: { glow: new THREE.Color('#4a4550'), zenith: new THREE.Color('#0d1a2c') },
};

/** Share of the way from the horizon colour to the glow, then from the glow to the zenith, at elevation `e` (deg). */
function skyMix(e: number): [glow: number, zenith: number] {
  return [smoothstep(0, 6, e), smoothstep(14, 70, e)];
}

// ---------------------------------------------------------------------------------------------------------------------
// Props.

interface Prop {
  /** Its footprint's radius (m), kept clear of the plots, the car and the road side. */
  r: number;
  build(seed: number, low: boolean): THREE.BufferGeometry;
  /** It turns to face the road (lamps, benches, shelters); otherwise it turns at random. */
  faces?: boolean;
  /** How far it reaches out over the road (m, a lamp's arm): that end too is kept clear. */
  arm?: number;
}

const green = (hex: string) => new THREE.Color(hex);
const PROPS = {
  sovietLamp: { r: 0.4, faces: true, arm: 1.4, build: () => lamp(4.4, 1.1, 'concrete', 'lastLight') },
  planty: { r: 0.4, faces: true, build: () => lamp(3.4, 0, 'soot', 'candle') },
  steelLamp: { r: 0.4, faces: true, arm: 1, build: () => lamp(4.8, 0.7, green('#6d7278'), 'lastLight') },
  poplar: { r: 1.2, build: (s, low) => poplar(s, { height: 7, low }) },
  chestnut: { r: 1.8, build: (s, low) => tree('broadleaf', s, { height: 4.6, low }) },
  lime: {
    r: 1.6,
    build: (s, low) => tree('broadleaf', s, { height: 4.2, low, foliage: 'meadow' }),
  },
  birch: { r: 1.2, build: (s, low) => tree('birch', s, { height: 4.4, low }) },
  pine: {
    r: 1.4,
    build: (s, low) => tree('conifer', s, { height: 6, low, foliage: green('#2f4a33') }),
  },
  spruce: { r: 1.4, build: (s, low) => tree('conifer', s, { height: 5, low }) },
  beech: { r: 1.8, build: (s, low) => tree('broadleaf', s, { height: 5, low, foliage: 'beech' }) },
  plane: {
    r: 1.8,
    build: (s, low) => tree('broadleaf', s, { height: 5, low, foliage: green('#6a8446') }),
  },
  bush: { r: 0.8, build: (s) => bush(s, 1) },
  rock: { r: 0.5, build: (s) => rock(s, 0.7) },
  sovietBench: {
    r: 1,
    faces: true,
    build: () => bench(1.6, { tint: green('#8a5a3a'), legTint: 'concrete' }),
  },
  plantyBench: {
    r: 1,
    faces: true,
    build: () => bench(1.8, { tint: green('#3f6b3f'), legTint: 'soot' }),
  },
  steelBench: {
    r: 1,
    faces: true,
    build: () => bench(1.6, { tint: green('#8a7a62'), legTint: 'ash' }),
  },
  urn: { r: 0.4, build: () => litterBin() },
  plantyBin: {
    r: 0.4,
    faces: true,
    build: () => litterBin({ style: 'post', tint: green('#2f4a36') }),
  },
  steelBin: {
    r: 0.4,
    faces: true,
    build: () => litterBin({ style: 'post', tint: green('#5f666d') }),
  },
  kerbPosts: {
    r: 1.2,
    faces: true,
    build: () => merge([-0.9, 0, 0.9].map((x) => place(bollard(0.55), x, 0, 0))),
  },
  plantyPosts: {
    r: 1.2,
    faces: true,
    build: () => merge([-0.9, 0, 0.9].map((x) => place(bollard(0.8, 'soot'), x, 0, 0))),
  },
  steelPosts: {
    r: 1.2,
    faces: true,
    build: () => merge([-0.9, 0, 0.9].map((x) => place(bollard(0.8, 'ash'), x, 0, 0))),
  },
  sovietShelter: { r: 2, faces: true, build: () => busShelter(3) },
  glassShelter: { r: 2, faces: true, build: () => busShelter(3, { style: 'glass' }) },
} satisfies Record<string, Prop>;
type PropKind = keyof typeof PROPS;

/** A street lamp as one painted part: its lantern painted `lampTint`, in the same draw call. */
function lamp(height: number, arm: number, tint: Tint, lampTint: Tint): THREE.BufferGeometry {
  const { body, lamp } = streetLamp({ height, arm, tint, lampTint });
  lamp.deleteAttribute('normal');
  return merge([body, lamp]);
}

/** A row of props along the road: across (m, to the right; negative is the scenes' side), spacing and what stands in it. */
interface Row {
  across: [number, number];
  every: number;
  /** Along the road, ± (m). */
  jitter: number;
  kinds: [PropKind, number][];
  /** Left out on phones. */
  desktop?: boolean;
}

/** What stands along the road in each era, from the verge back toward the fog. */
const ROWS: Record<Era, Row[]> = {
  kharkiv: [
    { across: [-4.7, -4.7], every: 13, jitter: 0, kinds: [['sovietLamp', 1]] },
    {
      across: [-5.2, -5.6],
      every: 6.5,
      jitter: 1.5,
      kinds: [
        ['urn', 2],
        ['sovietBench', 2],
        ['kerbPosts', 1],
        ['sovietShelter', 1],
      ],
    },
    {
      across: [-8.5, -10.5],
      every: 5,
      jitter: 1,
      kinds: [
        ['poplar', 3],
        ['chestnut', 2],
        ['lime', 2],
      ],
    },
    {
      across: [-14, -20],
      every: 7,
      jitter: 2,
      kinds: [
        ['chestnut', 2],
        ['birch', 2],
        ['bush', 1],
        ['poplar', 1],
      ],
    },
    {
      across: [-26, -36],
      every: 7,
      jitter: 3,
      kinds: [
        ['poplar', 2],
        ['lime', 2],
        ['birch', 1],
        ['bush', 1],
      ],
      desktop: true,
    },
  ],
  forest: [
    {
      across: [-6, -9],
      every: 3.5,
      jitter: 1.2,
      kinds: [
        ['pine', 4],
        ['birch', 1],
        ['bush', 1],
        ['rock', 1],
      ],
    },
    {
      across: [-12, -20],
      every: 4,
      jitter: 2,
      kinds: [
        ['pine', 4],
        ['birch', 1],
      ],
    },
    {
      across: [-24, -36],
      every: 5,
      jitter: 2.5,
      kinds: [
        ['pine', 3],
        ['chestnut', 1],
      ],
      desktop: true,
    },
  ],
  krakow: [
    { across: [-4.7, -4.7], every: 11, jitter: 0, kinds: [['planty', 1]] },
    {
      across: [-5.3, -5.5],
      every: 5.5,
      jitter: 1,
      kinds: [
        ['plantyBench', 3],
        ['plantyBin', 1],
        ['plantyPosts', 1],
      ],
    },
    {
      across: [-8.5, -11],
      every: 5.5,
      jitter: 1,
      kinds: [
        ['chestnut', 2],
        ['lime', 2],
      ],
    },
    {
      across: [-14, -22],
      every: 7,
      jitter: 2,
      kinds: [
        ['chestnut', 1],
        ['lime', 1],
        ['bush', 1],
      ],
    },
    {
      across: [-26, -36],
      every: 8,
      jitter: 3,
      kinds: [
        ['lime', 1],
        ['chestnut', 1],
      ],
      desktop: true,
    },
  ],
  war: [],
  germany: [
    { across: [-4.7, -4.7], every: 17, jitter: 0, kinds: [['steelLamp', 1]] },
    {
      across: [-5.2, -5.4],
      every: 8,
      jitter: 2,
      kinds: [
        ['steelBin', 1],
        ['steelPosts', 1],
        ['steelBench', 1],
      ],
    },
    {
      across: [-9, -12],
      every: 6,
      jitter: 1.5,
      kinds: [
        ['beech', 3],
        ['spruce', 2],
        ['birch', 1],
      ],
    },
    {
      across: [-15, -24],
      every: 6,
      jitter: 2,
      kinds: [
        ['spruce', 2],
        ['beech', 2],
        ['bush', 1],
        ['rock', 1],
      ],
    },
    {
      across: [-27, -38],
      every: 6,
      jitter: 3,
      kinds: [
        ['spruce', 2],
        ['beech', 1],
      ],
      desktop: true,
    },
  ],
  frankfurt: [
    { across: [-4.7, -4.7], every: 15, jitter: 0, kinds: [['steelLamp', 1]] },
    {
      across: [-5.3, -5.4],
      every: 7.5,
      jitter: 1.5,
      kinds: [
        ['steelBin', 2],
        ['glassShelter', 1],
        ['steelBench', 2],
        ['steelPosts', 1],
      ],
    },
    { across: [-9, -9], every: 7, jitter: 0.3, kinds: [['plane', 1]] },
    {
      across: [-14, -22],
      every: 8,
      jitter: 2,
      kinds: [
        ['plane', 1],
        ['lime', 1],
        ['bush', 1],
      ],
    },
    {
      across: [-27, -38],
      every: 9,
      jitter: 3,
      kinds: [
        ['plane', 1],
        ['spruce', 1],
      ],
      desktop: true,
    },
  ],
};

/** Picks a kind by weight. */
function pick(kinds: [PropKind, number][], x: number): PropKind {
  const total = kinds.reduce((a, [, w]) => a + w, 0);
  let t = x * total;
  for (const [kind, w] of kinds) if ((t -= w) < 0) return kind;
  return kinds[kinds.length - 1][0];
}

// ---------------------------------------------------------------------------------------------------------------------
// Silhouettes: three instanced shapes, scaled and tinted per instance.

type Shape = 'block' | 'hill' | 'cone';

interface Silhouette {
  shape: Shape;
  x: number;
  z: number;
  /** Width, height, depth (m). */
  size: [number, number, number];
  turn: number;
  tint: THREE.Color;
  /** Its foot (m): by default a metre under the ground, so it stands in the rise of the far fields. */
  y?: number;
}

/** Unit shapes standing on y = 0, painted white so the instance colour is theirs. */
function shapes(): Record<Shape, THREE.BufferGeometry> {
  const block = paint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 'chalk');
  const hill = paint(new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), 'chalk');
  const cone = paint(new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), 'chalk');
  for (const g of [block, hill, cone]) {
    g.getAttribute('color').array.fill(1);
    g.computeVertexNormals();
  }
  return { block, hill, cone };
}

/** The far silhouettes of an era, `count` along a stretch of road: what a place looks like from out in the fog. */
function silhouettesOf(
  era: Era,
  random: () => number,
  at: (along: number, across: number) => [number, number, number],
  from: number,
  to: number,
  phone: boolean,
): Silhouette[] {
  const out: Silhouette[] = [];
  const tint = (hex: string, spread = 0.1) => new THREE.Color(hex).multiplyScalar(1 + (random() - 0.5) * 2 * spread);
  const add = (
    shape: Shape,
    along: number,
    across: number,
    size: [number, number, number],
    hex: string,
    spread?: number,
  ): Silhouette => {
    const [x, z, heading] = at(along, across);
    const one: Silhouette = {
      shape,
      x,
      z,
      size,
      turn: heading + (random() - 0.5) * 0.5,
      tint: tint(hex, spread),
    };
    out.push(one);
    return one;
  };
  const thin = phone ? 1.6 : 1;
  const hills = (hex: string, height: [number, number], spacing: number) => {
    for (let s = from + random() * spacing; s < to; s += spacing * thin * (0.7 + random() * 0.6)) {
      const r = 18 + random() * 22;
      add(
        'hill',
        s,
        -(110 + random() * 25),
        [r, height[0] + random() * (height[1] - height[0]), r * (0.6 + random() * 0.3)],
        hex,
        0.12,
      );
    }
  };
  const trees = (hex: string, across: [number, number], spacing: number, height: [number, number]) => {
    for (let s = from + random() * spacing; s < to; s += spacing * thin * (0.6 + random() * 0.8)) {
      const h = height[0] + random() * (height[1] - height[0]);
      add('cone', s, across[0] + random() * (across[1] - across[0]), [h * 0.22, h, h * 0.22], hex, 0.15);
    }
  };
  switch (era) {
    case 'kharkiv': {
      // Microdistrict panel blocks of nine and sixteen storeys, a factory chimney now and then, the city's low hills.
      for (let s = from + random() * 10; s < to; s += 13 * thin * (0.7 + random() * 0.6)) {
        const tall = random() < 0.35;
        const h = tall ? 18 + random() * 4 : 11 + random() * 3;
        const w = tall ? 8 + random() * 4 : 16 + random() * 14;
        add('block', s, -(88 + random() * 25), [w, h, 7 + random() * 3], random() < 0.5 ? '#77736b' : '#6d7277', 0.12);
        if (random() < 0.12) add('block', s + 6, -(100 + random() * 15), [1.6, 22 + random() * 4, 1.6], '#7a4c40');
      }
      hills('#2c3326', [5, 10], 40);
      break;
    }
    case 'forest':
      trees('#27402c', [-60, -95], 3.5, [8, 13]);
      hills('#26352a', [8, 14], 35);
      break;
    case 'krakow': {
      // Old-town rows of townhouses, a copper spire over them, and the Kościuszko Mound in the west.
      for (let s = from + random() * 8; s < to; s += 11 * thin * (0.7 + random() * 0.6)) {
        add(
          'block',
          s,
          -(88 + random() * 22),
          [12 + random() * 10, 10 + random() * 4, 8],
          random() < 0.5 ? '#9a8b76' : '#8c7566',
          0.1,
        );
      }
      for (const k of [0.3, 0.7]) {
        const s = from + (to - from) * k;
        const across = -(95 + random() * 10);
        const tower = add('block', s, across, [3.2, 16 + random() * 4, 3.2], '#8a4f45', 0.05);
        add('cone', s, across, [2.4, 8, 2.4], PALETTE.krakowRoof, 0).y = tower.size[1];
      }
      add('cone', (from + to) / 2, -125, [26, 16, 26], '#34472e', 0.05);
      break;
    }
    case 'germany':
      // The Spessart: rounded wooded hills, beech with dark spruce stands.
      hills('#2f4630', [12, 22], 30);
      trees('#22382a', [-60, -95], 5, [8, 12]);
      break;
    case 'frankfurt':
      for (let s = from + random() * 8; s < to; s += 12 * thin * (0.7 + random() * 0.6)) {
        const tall = random() < 0.25;
        add(
          'block',
          s,
          -(90 + random() * 25),
          tall ? [9, 18 + random() * 5, 9] : [14 + random() * 10, 14 + random() * 10, 10],
          tall ? '#6b7784' : '#74746f',
          0.1,
        );
      }
      hills('#2f4630', [8, 14], 45);
      break;
    case 'war':
      break;
  }
  return out;
}

/** Silhouettes in three instanced meshes (one per shape), sharing the painted material. */
function instanced(list: Silhouette[], geometry: Record<Shape, THREE.BufferGeometry>): THREE.Group {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (const shape of ['block', 'hill', 'cone'] as Shape[]) {
    const mine = list.filter((l) => l.shape === shape);
    if (!mine.length) continue;
    const mesh = new THREE.InstancedMesh(geometry[shape], paintedMaterial(), mine.length);
    mine.forEach((l, i) => {
      const y = l.y ?? -1;
      m.compose(
        p.set(l.x, y, l.z),
        q.setFromAxisAngle(UP, l.turn),
        s.set(l.size[0], l.size[1] - Math.min(y, 0), l.size[2]),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, l.tint);
    });
    mesh.computeBoundingSphere();
    mesh.name = `silhouettes-${shape}`;
    group.add(asDetail(mesh));
  }
  return group;
}

/**
 * The world (#71): sky, ground, distance and roadside, built once along the camera's `path` (path.ts) for the
 * chapters' `spans`; `phone` gets fewer props and silhouettes and cheaper trees. Posed every frame by update().
 */
export class World {
  readonly object = new THREE.Group();
  readonly sky: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** Roadside props, a merged mesh per chapter, and those of the world built before the war. */
  readonly props: THREE.Mesh[] = [];
  /** Each props mesh's bounding sphere: those out past the fog are not drawn. */
  private readonly reach: THREE.Sphere[] = [];
  private readonly before: THREE.Object3D[] = [];
  private readonly after: THREE.Object3D[] = [];
  private readonly skyMix: [number, number][];
  private readonly horizon = new THREE.Color();
  private readonly colour = new THREE.Color();
  private dawn = -1;

  constructor(path: THREE.CatmullRomCurve3, spans: ChapterSpan[], phone = false) {
    this.object.name = 'world';
    const line = new CarLine(path);
    const count = spans.length;
    const anchors = spans.map((_, i) => chapterAnchor(i));
    const along = anchors.map((_, i) => line.at(i / (count - 1)));
    const eras = spans.map((s) => eraOf(s.chapter.scene));
    const nearest = (s: number) => {
      let best = 0;
      along.forEach((a, i) => (Math.abs(s - a) < Math.abs(s - along[best]) ? (best = i) : 0));
      return best;
    };
    const point = new THREE.Vector3();
    const heading = new THREE.Vector3();
    const side = new THREE.Vector3();

    // Sky: a dome of rings from below the horizon to the zenith, drawn first and behind everything, riding with the camera.
    const arc = RINGS.map(
      (e) =>
        new THREE.Vector2(
          Math.cos((e * Math.PI) / 180) * SKY_RADIUS + 1e-3,
          Math.sin((e * Math.PI) / 180) * SKY_RADIUS,
        ),
    );
    const dome = new THREE.LatheGeometry(arc, phone ? 16 : 24);
    this.skyMix = RINGS.map(skyMix);
    dome.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dome.getAttribute('position').count * 3), 3));
    dome.deleteAttribute('uv');
    this.sky = new THREE.Mesh(
      dome,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: false,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.sky.name = 'sky';
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.object.add(this.sky);

    // Ground: one sheet along the whole road, under it and the plots, out into the fog, tinted per era; a segment every
    // three chapters or so, so those out of view are culled.
    const step = phone ? 5 : 4;
    const tint = new THREE.Color();
    const groundColour = (s: number, across: number, x: number, z: number, k: number, c: number, out: THREE.Color) => {
      // Blended from the nearest chapter's era to its neighbour's, over the middle of the gap between them.
      const i = nearest(s);
      const j = s > along[i] ? Math.min(i + 1, count - 1) : Math.max(i - 1, 0);
      const t = j === i ? 0 : smoothstep(0.35, 0.5, Math.abs(s - along[i]) / Math.abs(along[j] - along[i]));
      tintOf(eras, i, j, t, 'field', out);
      const plotAt = Math.min(
        Math.hypot(x - anchors[i].x, z - anchors[i].z),
        Math.hypot(x - anchors[j].x, z - anchors[j].z),
      );
      const plot = 1 - smoothstep(PLOT - 1, PLOT + 3, plotAt);
      if (plot > 0) out.lerp(tintOf(eras, i, j, t, 'plot', tint), plot);
      const verge = (across <= -3.3 && across >= -4.7) || (across >= 4.1 && across <= 5.4);
      if (verge) out.lerp(tintOf(eras, i, j, t, 'verge', tint), 0.85);
      out.multiplyScalar((1 - 0.35 * smoothstep(25, 90, Math.abs(across))) * (1 + (hash(k, c) - 0.5) * 0.14));
      return out;
    };
    const height = (across: number, k: number, c: number) =>
      GROUND_Y + (across < -30 ? smoothstep(30, 80, -across) * (0.4 + hash(c, k) * 1.4) : 0);
    const breaks = [-BACK, ...[2.5, 5.5, 8.5, 11.5].map((i) => line.at(i / (count - 1))), line.length + ON];
    const ground = new THREE.Group();
    ground.name = 'ground';
    for (let b = 1; b < breaks.length; b++) {
      const position: number[] = [];
      const colour: number[] = [];
      const k0 = Math.floor(breaks[b - 1] / step);
      const k1 = Math.ceil(breaks[b] / step);
      const c = new THREE.Color();
      const corner = (k: number, col: number) => {
        const s = k * step;
        const across = ACROSS[col];
        line.frame(s, across, point, heading, side);
        position.push(point.x, height(across, k, col), point.z);
        groundColour(s, across, point.x, point.z, k, col, c);
        colour.push(c.r, c.g, c.b);
      };
      for (let k = k0; k < k1; k++)
        for (let col = 1; col < ACROSS.length; col++) {
          // Two triangles facing up (the right is +across, the road runs on along -z of its heading).
          corner(k, col - 1);
          corner(k, col);
          corner(k + 1, col - 1);
          corner(k, col);
          corner(k + 1, col);
          corner(k + 1, col - 1);
        }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, paintedMaterial());
      mesh.name = 'ground';
      ground.add(mesh);
    }
    this.object.add(ground);

    // Roadside props: rows along the road per era, seeded per chapter, merged into a mesh per chapter.
    const clear = (x: number, z: number, r: number) =>
      anchors.every((a) => {
        const qx = x - a.x;
        const qz = z - a.z;
        if (Math.hypot(qx, qz) < PLOT + r + 0.5) return false;
        if (qx > CAR.min.x - r && qx < CAR.max.x + r && qz > CAR.min.z - r && qz < CAR.max.z + r) return false;
        return !(qx > ROAD_SIDE.min.x - r && qz > ROAD_SIDE.min.z - r && qz < ROAD_SIDE.max.z + r);
      });
    const m = new THREE.Matrix4();
    spans.forEach((span, i) => {
      const era = eras[i];
      const from = i === 0 ? -BACK : (along[i - 1] + along[i]) / 2;
      const to = i === count - 1 ? line.length + ON : (along[i] + along[i + 1]) / 2;
      const random = seeded(7100 + i);
      const parts: THREE.BufferGeometry[] = [];
      for (const row of ROWS[era]) {
        if (row.desktop && phone) continue;
        const every = row.every * (phone ? 1.7 : 1);
        for (let s = from + random() * every; s < to; s += every) {
          const kind = PROPS[pick(row.kinds, random())] as Prop;
          const across = Math.min(row.across[0] + random() * (row.across[1] - row.across[0]), VERGE - kind.r);
          const at = s + (random() - 0.5) * 2 * row.jitter;
          const seed = 1000 * i + parts.length;
          const turn = random() * Math.PI * 2;
          line.frame(at, across, point, heading, side);
          if (!clear(point.x, point.z, kind.r)) continue;
          if (kind.arm && !clear(point.x + side.x * kind.arm, point.z + side.z * kind.arm, 0.3)) continue;
          const rotation = kind.faces ? Math.atan2(side.x, side.z) : turn;
          const part = kind.build(seed, phone);
          part.applyMatrix4(m.makeRotationY(rotation).setPosition(point.x, 0, point.z));
          parts.push(part);
        }
      }
      if (!parts.length) return;
      const geometry = merge(parts);
      bakeAO(geometry, { corner: 0, fade: 1 });
      const mesh = detailMesh(geometry);
      mesh.name = `props-${span.chapter.id}`;
      geometry.computeBoundingSphere();
      this.reach.push(geometry.boundingSphere!);
      this.props.push(mesh);
      (span.chapter.phase === 'build' ? this.before : this.after).push(mesh);
      this.object.add(mesh);
    });

    // Distance: silhouettes of the era's place far off the road on the scenes' side, in the fog band.
    const shapeGeometry = shapes();
    const lists: Record<'before' | 'after', Silhouette[]> = { before: [], after: [] };
    const at = (s: number, across: number): [number, number, number] => {
      line.frame(s, across, point, heading, side);
      return [point.x, point.z, Math.atan2(side.x, side.z)];
    };
    spans.forEach((span, i) => {
      const from = i === 0 ? -BACK : (along[i - 1] + along[i]) / 2;
      const to = i === count - 1 ? line.length + ON : (along[i] + along[i + 1]) / 2;
      lists[span.chapter.phase === 'build' ? 'before' : 'after'].push(
        ...silhouettesOf(eras[i], seeded(7300 + i), at, from, to, phone),
      );
    });
    const far = {
      before: instanced(lists.before, shapeGeometry),
      after: instanced(lists.after, shapeGeometry),
    };
    far.before.name = 'distance-before';
    far.after.name = 'distance-after';
    this.before.push(far.before);
    this.after.push(far.after);
    this.object.add(far.before, far.after);
  }

  /**
   * Poses the world for journey `progress`, the camera at `camera`, the sky `dawn` (grade.ts dawnAt) of the way to
   * dawn, `fog` its colour; `whole` while the world built before the war stands (false once the shatter has taken it).
   * Allocation-free.
   */
  update(progress: number, camera: THREE.Vector3, dawn: number, fog: THREE.Color, whole: boolean): void {
    this.sky.position.copy(camera);
    for (const o of this.before) o.visible = whole;
    for (const o of this.after) o.visible = progress >= DRIVE.from;
    this.props.forEach((mesh, i) => (mesh.visible &&= this.reach[i].distanceToPoint(camera) < FOG_FAR));
    if (dawn === this.dawn && this.horizon.equals(fog)) return;
    this.dawn = dawn;
    this.horizon.copy(fog);
    const colours = this.sky.geometry.getAttribute('color') as THREE.BufferAttribute;
    const rings = this.skyMix.length;
    const glow = this.colour;
    for (let r = 0; r < rings; r++) {
      const [toGlow, toZenith] = this.skyMix[r];
      glow.lerpColors(SKY.night.glow, SKY.dawn.glow, dawn);
      const zr = THREE.MathUtils.lerp(SKY.night.zenith.r, SKY.dawn.zenith.r, dawn);
      const zg = THREE.MathUtils.lerp(SKY.night.zenith.g, SKY.dawn.zenith.g, dawn);
      const zb = THREE.MathUtils.lerp(SKY.night.zenith.b, SKY.dawn.zenith.b, dawn);
      glow.lerpColors(fog, glow, toGlow);
      const cr = glow.r + (zr - glow.r) * toZenith;
      const cg = glow.g + (zg - glow.g) * toZenith;
      const cb = glow.b + (zb - glow.b) * toZenith;
      for (let v = r; v < colours.count; v += rings) colours.setXYZ(v, cr, cg, cb);
    }
    colours.needsUpdate = true;
  }
}

/** An era tint blended between chapters `i` and `j`, `t` of the way, into `out`. */
function tintOf(
  eras: Era[],
  i: number,
  j: number,
  t: number,
  key: 'field' | 'plot' | 'verge',
  out: THREE.Color,
): THREE.Color {
  const a = new THREE.Color(GROUND[eras[i]][key]);
  return out.copy(a).lerp(a.set(GROUND[eras[j]][key]), t);
}
