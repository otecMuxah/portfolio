import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CarId } from '../content/life';
import { asDetail, box as painted, merge, paint, paintedMaterial, place } from './art/details';

type Profile = [x: number, y: number][];

/**
 * A car's dressing (#72): bumpers, plates, mirrors, shut-lines, grille, badges, lamp clusters and wheel faces. Sizes are
 * real (m). At the road camera 1 m is about 50 px on a desktop and 20 px on a phone, so no part is thinner than 3 cm.
 */
interface Trim {
  /** Headlamps: twin rounds, or a rectangle [height, width] each side, wrapping the corner. */
  lamps: 'round' | [h: number, w: number];
  /** Tail-light blocks each side: [y, height, width, inset of its centre from the side]. The first carries the amber. */
  tails: [y: number, h: number, w: number, inset: number][];
  /** Door shut-lines (x). */
  doors: number[];
  /** Bumpers and mirrors: unpainted plastic, or 'body' for the body colour. */
  bumper: string;
  mirror: string;
  /** Rear plate height, up on the boot or tailgate; on the bumper when unset. */
  plateY?: number;
  /** Wheel faces: a steel wheel's plastic cover, or an alloy with this many spokes; in `rimTint`. */
  rim: 'cover' | number;
  rimTint: string;
  /** Whatever else makes this car itself, as painted parts in car space. */
  more?: (parts: THREE.BufferGeometry[], car: Landmarks) => void;
}

/** Where things sit on a car (car space: front +x, left -z, ground y = 0). */
interface Landmarks {
  model: CarModel;
  body: THREE.Color;
  bottom: number;
  belt: number;
  lightY: number;
  half: number;
  /** The x of the nose, or of the tail, at a height. */
  nose: (y: number) => number;
  tail: (y: number) => number;
}

/** Side profile of a low-poly car, front towards +x, ground at y = 0. */
interface CarModel {
  colour: string;
  width: number;
  wheelRadius: number;
  /** Front and rear axle x. */
  axles: [front: number, rear: number];
  /** Body below the beltline. */
  lower: Profile;
  /** Glasshouse on the beltline; its highest edge gets a body-coloured roof. */
  cabin: Profile;
  trim: Trim;
  extras?: (car: THREE.Group, body: THREE.Material) => void;
}

const PLASTIC = '#1d1e22';
const CHROME = '#c9ced6';
const AMBER = '#f39a2b';
const SILVER = '#b8bdc4';

const MODELS: Record<CarId, CarModel> = {
  // Boxy two-box hatch with an upright tailgate.
  golf2: {
    colour: '#c8202a',
    width: 1.7,
    wheelRadius: 0.33,
    axles: [1.2, -1.2],
    lower: [[-1.9, 0.3], [1.9, 0.3], [1.95, 0.72], [1.85, 0.92], [0.95, 0.97], [-1.85, 0.97], [-1.95, 0.7]],
    cabin: [[0.9, 0.97], [0.3, 1.42], [-1.45, 1.42], [-1.82, 0.97]],
    // Mk2 (1983-92): twin round lamps in a black grille with the VW badge, black bumpers and rubbing strips, wide
    // tail-lights, one long door a side, steel wheels under plastic covers.
    trim: {
      lamps: 'round',
      tails: [[0.8, 0.15, 0.4, 0.29]],
      doors: [0.85, -0.45],
      bumper: PLASTIC,
      mirror: PLASTIC,
      rim: 'cover',
      rimTint: SILVER,
      more: (parts, { nose, half, lightY }) => {
        parts.push(cube([0.05, 0.19, 2 * half - 0.2], PLASTIC, nose(lightY) - 0.03, lightY, 0));
        parts.push(badge(0.065, CHROME, nose(lightY) + 0.005, lightY, 0));
        // The rubbing strip down each side, between the arches.
        parts.push(cube([1.5, 0.07, 2 * half + 0.03], PLASTIC, 0, 0.6, 0));
      },
    },
  },
  // Low liftback whose roof runs in one long slope down to the tail.
  mazda323f: {
    colour: '#a3121c',
    width: 1.7,
    wheelRadius: 0.32,
    axles: [1.3, -1.3],
    lower: [[-2.15, 0.3], [2.15, 0.3], [2.22, 0.58], [2.05, 0.8], [0.9, 0.95], [-2.05, 0.98], [-2.2, 0.66]],
    cabin: [[0.85, 0.95], [0.1, 1.38], [-0.7, 1.4], [-2.05, 0.98]],
    trim: {
      lamps: [0.1, 0.36],
      tails: [[0.72, 0.12, 0.5, 0.3]],
      doors: [0.8, -0.5],
      bumper: 'body',
      mirror: PLASTIC,
      rim: 5,
      rimTint: SILVER,
    },
    extras: (car, body) => car.add(box([0.12, 0.05, 1.5], [-2.05, 1.03, 0], body)),
  },
  // Rounded five-door hatch with a raked windscreen.
  mazda3: {
    colour: '#1f5fbf',
    width: 1.75,
    wheelRadius: 0.34,
    axles: [1.35, -1.35],
    lower: [[-2.2, 0.3], [2.2, 0.3], [2.27, 0.68], [2.1, 0.9], [1, 1.02], [-2.15, 1.05], [-2.25, 0.7]],
    cabin: [[0.95, 1.02], [0.2, 1.52], [-1.1, 1.54], [-1.85, 1.35], [-2.1, 1.05]],
    trim: {
      lamps: [0.12, 0.4],
      tails: [[0.95, 0.14, 0.3, 0.2]],
      doors: [0.9, -0.2, -1.3],
      bumper: 'body',
      mirror: 'body',
      rim: 5,
      rimTint: SILVER,
    },
  },
  // Estate-shaped SUV: high ground clearance, big wheels, roof rails. The SH (2008-13) stands 1.7 m to its rails,
  // well above the Golf but no van.
  forester: {
    colour: '#2f7d3a',
    width: 1.8,
    wheelRadius: 0.37,
    axles: [1.35, -1.35],
    lower: [[-2.25, 0.4], [2.25, 0.4], [2.3, 0.85], [2.2, 1.05], [1.2, 1.12], [-2.2, 1.14], [-2.3, 0.88]],
    cabin: [[1.15, 1.12], [0.5, 1.64], [-1.95, 1.66], [-2.15, 1.14]],
    // Swept lamps either side of a dark grille with the blue star badge, black cladding along the sills, tall
    // tail-lights up the tailgate's sides, roof rails, five-spoke alloys.
    trim: {
      lamps: [0.13, 0.42],
      tails: [[0.98, 0.3, 0.2, 0.1]],
      doors: [0.95, -0.25, -1.35],
      bumper: PLASTIC,
      mirror: 'body',
      plateY: 0.8,
      rim: 5,
      rimTint: SILVER,
      more: (parts, { nose, half, lightY, bottom }) => {
        parts.push(cube([0.05, 0.16, 0.6], PLASTIC, nose(lightY) - 0.02, lightY - 0.03, 0));
        parts.push(badge(0.075, '#2b4fa0', nose(lightY) + 0.01, lightY - 0.03, 0, 0.6));
        parts.push(cube([2.1, 0.16, 2 * half + 0.03], PLASTIC, 0, bottom + 0.06, 0));
        for (const z of [-0.7, 0.7]) parts.push(cube([2.2, 0.06, 0.06], PLASTIC, -0.7, 1.76, z));
      },
    },
  },
  // Long, low three-box saloon with a boot and a twin kidney grille.
  f30: {
    colour: '#24272e',
    width: 1.8,
    wheelRadius: 0.34,
    axles: [1.4, -1.4],
    lower: [[-2.3, 0.3], [2.3, 0.3], [2.36, 0.68], [2.2, 0.9], [1.1, 1], [-1.55, 1.05], [-2.3, 1.02], [-2.36, 0.68]],
    cabin: [[1.05, 1], [0.35, 1.45], [-0.9, 1.47], [-1.55, 1.05]],
    // F30 (2012-19): the twin kidneys between long lamps that run into them, the roundel on bonnet and boot, L-shaped
    // tail-lights wrapping the rear corners, body-coloured bumpers, five-spoke alloys in dark grey.
    trim: {
      lamps: [0.1, 0.5],
      tails: [
        [0.9, 0.1, 0.46, 0.33],
        [0.8, 0.2, 0.12, 0.08],
      ],
      doors: [1.0, -0.15, -1.2],
      bumper: 'body',
      mirror: 'body',
      plateY: 0.72,
      rim: 5,
      rimTint: '#8a8f97',
      more: (parts, { nose, tail, lightY }) => {
        for (const z of [-0.17, 0.17]) {
          parts.push(cube([0.06, 0.2, 0.26], CHROME, nose(lightY) - 0.02, lightY, z));
          parts.push(cube([0.06, 0.15, 0.2], PLASTIC, nose(lightY) - 0.01, lightY, z));
        }
        parts.push(roundel(nose(0.86) - 0.005, 0.86, 0.94));
        parts.push(roundel(tail(0.95) + 0.005, 0.95, -1.4));
      },
    },
  },
};

const GLASS = new THREE.MeshStandardMaterial({ color: '#43546a', metalness: 0.4, roughness: 0.2, flatShading: true });
/** Tyres with their wheel faces, painted into one geometry: the vertex colours are the colours. */
const TYRE = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const HEADLIGHT = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#fff4d6', emissiveIntensity: 1.5 });
const TAILLIGHT = new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 1.5 });

/** Builds a car as a group; its parts are named (wheels as `wheel`) so the rig can spin them. */
export function buildCar(carId: CarId): THREE.Group {
  const model = MODELS[carId];
  const body = new THREE.MeshStandardMaterial({
    color: model.colour,
    flatShading: true,
    metalness: 0.2,
    roughness: 0.45,
  });
  const car = new THREE.Group();
  car.name = carId;
  car.userData['colour'] = model.colour;
  car.add(named('body', extrude(model.lower, model.width, body)));
  car.add(named('cabin', extrude(model.cabin, model.width - 0.2, GLASS)));

  const roofY = Math.max(...model.cabin.map(([, y]) => y));
  const roofXs = model.cabin.filter(([, y]) => y > roofY - 0.05).map(([x]) => x);
  const roofMin = Math.min(...roofXs);
  const roofMax = Math.max(...roofXs);
  car.add(named('roof', box([roofMax - roofMin + 0.1, 0.06, model.width - 0.14], [(roofMin + roofMax) / 2, roofY + 0.03, 0], body)));

  const at: Landmarks = {
    model,
    body: new THREE.Color(model.colour),
    bottom: model.lower[0][1],
    belt: model.cabin[0][1],
    lightY: model.lower[2][1] + 0.05,
    half: model.width / 2,
    nose: (y) => xAt(model.lower, y, 1),
    tail: (y) => xAt(model.lower, y, -1),
  };
  // One mesh per lamp material, both sides and every block of a cluster in it.
  const { heads, tails } = lamps(at);
  car.add(named('headlight', new THREE.Mesh(heads, HEADLIGHT)), named('taillight', new THREE.Mesh(tails, TAILLIGHT)));
  // Detail: the war breaks the car's body and wheels, and the trim goes out as it starts.
  car.add(named('trim', asDetail(new THREE.Mesh(trim(at), paintedMaterial()))));

  const r = model.wheelRadius;
  const right = wheel(r, model.trim);
  const left = mirrored(right.clone());
  for (const x of model.axles) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(side > 0 ? right : left, TYRE);
      wheel.name = 'wheel';
      wheel.position.set(x, r, side * (model.width / 2 - 0.1));
      car.add(wheel);
    }
  }
  model.extras?.(car, body);
  return car;
}

export function wheelRadius(carId: CarId): number {
  return MODELS[carId].wheelRadius;
}

/** The headlamps and tail-lights: each merged into one geometry for its lamp material. */
function lamps({ model, lightY, half, nose, tail }: Landmarks): { heads: THREE.BufferGeometry; tails: THREE.BufferGeometry } {
  const heads: THREE.BufferGeometry[] = [];
  const tails: THREE.BufferGeometry[] = [];
  const { lamps: shape, tails: blocks } = model.trim;
  for (const side of [-1, 1]) {
    if (shape === 'round') {
      const round = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 10).rotateZ(Math.PI / 2);
      heads.push(round.translate(nose(lightY), lightY, side * (half - 0.3)));
    } else {
      const [h, w] = shape;
      heads.push(new THREE.BoxGeometry(0.16, h, w).translate(nose(lightY) - 0.06, lightY, side * (half - 0.08 - w / 2)));
    }
    for (const [y, h, w, inset] of blocks) tails.push(new THREE.BoxGeometry(0.1, h, w).translate(tail(y) + 0.03, y, side * (half - inset)));
  }
  return { heads: mergeGeometries(heads)!, tails: mergeGeometries(tails)! };
}

/** Bumpers, plates, mirrors, shut-lines, indicators and the model's own marks, painted into one geometry. */
function trim(at: Landmarks): THREE.BufferGeometry {
  const { model, body, bottom, belt, lightY, half, nose, tail } = at;
  const t = model.trim;
  const tint = (c: string) => (c === 'body' ? body : new THREE.Color(c));
  const parts: THREE.BufferGeometry[] = [];

  // Bumpers across nose and tail, standing a little proud of them.
  const bumperY = bottom + 0.11;
  parts.push(cube([0.16, 0.22, 2 * half + 0.03], tint(t.bumper), nose(bumperY) - 0.06, bumperY, 0, t.bumper === 'body' ? 0.8 : 1));
  parts.push(cube([0.16, 0.22, 2 * half + 0.03], tint(t.bumper), tail(bumperY) + 0.06, bumperY, 0, t.bumper === 'body' ? 0.8 : 1));
  // Number plates (520 x 110 mm).
  plate(parts, nose(bumperY) + 0.035, bumperY, 1);
  if (t.plateY === undefined) plate(parts, tail(bumperY) - 0.035, bumperY, -1);
  else plate(parts, tail(t.plateY) - 0.01, t.plateY, -1);

  // Mirrors at the foot of the A-pillars, standing out past the body.
  for (const side of [-1, 1]) {
    parts.push(cube([0.14, 0.11, 0.16], tint(t.mirror), model.cabin[0][0] - 0.22, belt + 0.1, side * (half + 0.07)));
  }
  // Shut-lines: a darker slot down both sides at each door edge, from sill to beltline.
  for (const x of t.doors) parts.push(cube([0.035, belt - bottom - 0.12, 2 * half + 0.012], body, x, (belt + bottom) / 2, 0, 0.45));

  // Amber indicators: at the outer end of each headlamp (in the bumper corners, beside round ones) and inboard of the
  // first tail-light block.
  const [ty, th, tw, inset] = t.tails[0];
  for (const side of [-1, 1]) {
    if (t.lamps === 'round') parts.push(cube([0.05, 0.07, 0.16], AMBER, nose(bumperY) + 0.03, bumperY + 0.02, side * (half - 0.14)));
    else parts.push(cube([0.14, t.lamps[0] * 0.7, 0.07], AMBER, nose(lightY) - 0.07, lightY, side * (half - 0.045)));
    parts.push(cube([0.1, th, 0.08], AMBER, tail(ty) + 0.025, ty, side * (half - inset - tw / 2 - 0.04)));
  }
  t.more?.(parts, at);
  return merge(parts);
}

/** A number plate on the nose (`end` 1) or the tail (-1): white, the blue band at the reader's left, dark characters. */
function plate(parts: THREE.BufferGeometry[], x: number, y: number, end: 1 | -1): void {
  parts.push(cube([0.03, 0.11, 0.52], '#eef0ea', x, y, 0));
  // Facing the nose your left is +z; facing the tail it is -z.
  parts.push(cube([0.03, 0.11, 0.07], '#2f5fb3', x + end * 0.004, y, end * 0.225));
  parts.push(cube([0.03, 0.035, 0.34], '#2b2d33', x + end * 0.004, y, -end * 0.04));
}

/** A tyre and its outer wheel face (+z), painted into one geometry that turns about z with the wheel. */
function wheel(r: number, { rim, rimTint }: Trim): THREE.BufferGeometry {
  const face = 0.14;
  /** A flat disc on the wheel face, `lift` in front of the tyre's sidewall. */
  const disc = (radius: number, lift: number, colour: string, sides = 10) =>
    paint(new THREE.CircleGeometry(radius, sides).translate(0, 0, face + lift), new THREE.Color(colour));
  const parts = [paint(new THREE.CylinderGeometry(r, r, 0.28, 10).rotateX(Math.PI / 2), new THREE.Color('#141414'))];
  if (rim === 'cover') {
    // A steel wheel's plastic cover: a flat silver dish, a dark ring of vents, the hub.
    parts.push(disc(r * 0.74, 0.004, rimTint), disc(r * 0.52, 0.008, '#3a3d42'), disc(r * 0.36, 0.012, rimTint, 8));
  } else {
    // An alloy: the rim's lip, the dark well behind the spokes, the hub.
    parts.push(disc(r * 0.74, 0.004, rimTint), disc(r * 0.62, 0.008, '#26282c'));
    for (let i = 0; i < rim; i++) {
      const spoke = new THREE.PlaneGeometry(0.07, r * 0.56).translate(0, r * 0.33, face + 0.012).rotateZ((i / rim) * Math.PI * 2);
      parts.push(paint(spoke, new THREE.Color(rimTint)));
    }
    parts.push(disc(r * 0.17, 0.016, rimTint, 6));
  }
  return merge(parts);
}

/** A geometry mirrored across z = 0, each triangle turned back to face out. */
function mirrored(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.scale(1, 1, -1);
  for (const name of ['position', 'color']) {
    const attr = geometry.getAttribute(name) as THREE.BufferAttribute;
    const n = attr.itemSize;
    const a = attr.array;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const swap = a[(i + 1) * n + k];
        a[(i + 1) * n + k] = a[(i + 2) * n + k];
        a[(i + 2) * n + k] = swap;
      }
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The far x of a profile at height `y`: its nose (`end` 1) or its tail (-1). */
function xAt(profile: Profile, y: number, end: 1 | -1): number {
  let best = -end * Infinity;
  for (let i = 0; i < profile.length; i++) {
    const [ax, ay] = profile[i];
    const [bx, by] = profile[(i + 1) % profile.length];
    if (ay === by || (ay - y) * (by - y) > 0) continue;
    const x = ax + ((y - ay) / (by - ay)) * (bx - ax);
    best = end > 0 ? Math.max(best, x) : Math.min(best, x);
  }
  return best;
}

/** A painted box [length, height, width] centred at (x, y, z). */
function cube(
  [l, h, w]: [number, number, number],
  tint: string | THREE.Color,
  x: number,
  y: number,
  z: number,
  shading = 1,
): THREE.BufferGeometry {
  return place(painted(l, h, w, typeof tint === 'string' ? new THREE.Color(tint) : tint, shading), x, y - h / 2, z);
}

/** A badge facing forward (+x); `squash` below 1 makes it an oval, wider than tall. */
function badge(radius: number, tint: string, x: number, y: number, z: number, squash = 1): THREE.BufferGeometry {
  const disc = new THREE.CylinderGeometry(radius, radius, 0.02, 8).rotateZ(Math.PI / 2).scale(1, squash, 1);
  return paint(disc.translate(x, y, z), new THREE.Color(tint));
}

/** BMW's roundel, quartered blue and white in a black ring, at (x, y) on the centre line, tilted `tilt` from facing up towards +x. */
function roundel(x: number, y: number, tilt: number): THREE.BufferGeometry {
  const disc = (radius: number, height: number, colour: string, start = 0, sweep = Math.PI * 2, sides = 8) =>
    paint(new THREE.CylinderGeometry(radius, radius, height, sides, 1, false, start, sweep), new THREE.Color(colour));
  return merge([
    disc(0.065, 0.012, '#15161a'),
    disc(0.045, 0.016, '#f2f2f2'),
    disc(0.045, 0.02, '#2f6fc4', 0, Math.PI / 2, 2),
    disc(0.045, 0.02, '#2f6fc4', Math.PI, Math.PI / 2, 2),
  ])
    .rotateZ(-tilt)
    .translate(x, y, 0);
}

function named<T extends THREE.Object3D>(name: string, object: T): T {
  object.name = name;
  return object;
}

function extrude(profile: Profile, depth: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
}

function box(size: [number, number, number], at: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...at);
  return mesh;
}
