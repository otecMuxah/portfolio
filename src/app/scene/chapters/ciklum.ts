import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Assembly, Piece, pieceMaterial, unit } from '../art/assembly';
import { halo, haloMap, leave, seeded, smoothstep } from '../art/kit';
import { PALETTE, PaletteKey } from '../art/palette';
import { ChapterBuilder } from '../chapter-scene';

/** Screen-right and into the screen, seen from the camera road ((18, 7, 16) from the anchor). */
const ACROSS = new THREE.Vector3(16, 0, -18).normalize();
const DEPTH = new THREE.Vector3(-18, 0, -16).normalize();

/** A point `s` m across the frame and `t` m into it (past the point the camera looks at), `y` m up. */
function place(s: number, t: number, y = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(0, y, 0).addScaledVector(ACROSS, s).addScaledVector(DEPTH, t);
}

/** How far across the frame (`s`) and into it (`t`) a point of the plot lies. */
function framed(x: number, z: number): [s: number, t: number] {
  return [x * ACROSS.x + z * ACROSS.z, x * DEPTH.x + z * DEPTH.z];
}

/**
 * The Main runs across the frame between the house and the castle, from this far into it to that, and ends behind
 * the forest on the right.
 */
const RIVER_NEAR = -0.9;
const RIVER_FAR = 2.3;
const RIVER_END = 4.4;
const WATER = -0.12;

/**
 * The house, on the near bank in front of the forest, its gable and front door turned to the road where the F30 pulls
 * up at the end of the drive (escape.ts: at the chapter's midpoint, at CAR_OFFSET (12, 0, 2), heading down the road).
 */
const HOUSE = new THREE.Vector3(4.9, 0, 0);
const HOUSE_YAW = -0.21;
/** Its model is built in round metres and set down a little smaller, so the castle behind stays the grander thing. */
const HOUSE_SCALE = 0.85;
/** Half its depth (along its ridge, toward the road) and half its width. */
const HD = 2.4;
const HW = 2.1;
const EAVE = 3.4;
const RIDGE = 5.6;
const CHIMNEY = new THREE.Vector3(-1, 0, -0.8);

/** Schloss Johannisburg, across the water, turned a little from the camera so two of its wings show. */
const CASTLE = place(-3, 6.3);
const CASTLE_YAW = 0.5;
/** Metres to the model's unit: it keeps inside the plot. */
const CASTLE_SCALE = 0.8;
/** The terrace it stands on above the river. */
const PLINTH = 1.3;

/** The castle goes up over this stretch of the chapter, as the car comes in and the camera arrives. */
const BUILD_FROM = 0.14;
const BUILD_TO = 0.47;

/** Nothing on the near side reaches the road: its left verge runs about here (x) at `z`, clear of the car. */
function roadside(z: number): number {
  return Math.min(8.6 + 0.2 * (4 - z), 10.6);
}

/** Merges parts into one geometry, each part painted a palette colour (vertex colours): one draw call, still plain. */
function paint(parts: [THREE.BufferGeometry, PaletteKey | THREE.Color][]): THREE.BufferGeometry {
  const colour = new THREE.Color();
  const flat = parts.map(([g, c]) => {
    const f = (g.index ? g.toNonIndexed() : g.clone()).deleteAttribute('uv').deleteAttribute('normal');
    g.dispose();
    colour.set(c instanceof THREE.Color ? c : PALETTE[c]);
    const count = f.getAttribute('position').count;
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colour.toArray(colours, i * 3);
    f.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return f;
  });
  const merged = mergeGeometries(flat);
  flat.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

/** A unit roof: a triangular prism, ridge along x, on y = 0 (no underside: it is never seen). */
function prism(): THREE.BufferGeometry {
  const [a0, b0, c0, a1, b1, c1] = [
    [-0.5, 0, -0.5],
    [-0.5, 0, 0.5],
    [-0.5, 1, 0],
    [0.5, 0, -0.5],
    [0.5, 0, 0.5],
    [0.5, 1, 0],
  ];
  const faces = [a0, b0, c0, a1, c1, b1, b0, b1, c1, b0, c1, c0, a0, c0, c1, a0, c1, a1];
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(faces.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The corner towers' caps, the welsche Haube: a bell that pinches in above the eaves, swells and tapers to a neck, an
 * open lantern and a spire. Octagonal, like the storeys under it.
 */
function haube(): THREE.BufferGeometry {
  const profile = [
    [1, 0],
    [0.78, 0.1],
    [0.86, 0.26],
    [0.62, 0.46],
    [0.24, 0.58],
    [0.28, 0.6],
    [0.28, 0.76],
    [0.04, 1],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return unit(new THREE.LatheGeometry(profile, 8).rotateY(Math.PI / 8));
}

/** The three-tiered transverse gable at the middle of each wing's roof, its steps rounded into volutes. */
function gable(): THREE.BufferGeometry {
  const steps = [
    [0.5, 0.3, 0.36, 0.4],
    [0.36, 0.62, 0.24, 0.72],
    [0.24, 0.86, 0.1, 0.94],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  for (const [x, y, x2, y2] of steps) {
    shape.lineTo(x, y);
    shape.quadraticCurveTo(x, y2, x2, y2);
  }
  shape.lineTo(0.03, 1);
  shape.lineTo(-0.03, 1);
  for (const [x, y, x2, y2] of [...steps].reverse()) {
    shape.lineTo(-x2, y2);
    shape.quadraticCurveTo(-x, y2, -x, y);
  }
  shape.lineTo(-0.5, 0);
  return unit(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 2 }));
}

/**
 * Rows of windows on a wall's outer face: quads on z = 0.5 of a unit box (x ±0.5, y 0..1), so a piece posed like its
 * wall puts them on the wall's face. Not unit-scaled: it is flat.
 */
function windowGrid(rows: number, cols: number, w: number, h: number): THREE.BufferGeometry {
  const quads: THREE.BufferGeometry[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = cols > 1 ? -0.5 + (c + 0.5) / cols : 0;
      quads.push(new THREE.PlaneGeometry(w, h).translate(x, (r + 0.55) / rows, 0.505));
    }
  const merged = mergeGeometries(quads);
  quads.forEach((g) => g.dispose());
  return merged.deleteAttribute('uv');
}

/**
 * Schloss Johannisburg (1605–1614), after the descriptions of it: four red-sandstone wings of three storeys around a
 * square courtyard, a tall corner tower at each corner standing out past the walls, square up to its seventh storey
 * and octagonal above, under a slate welsche Haube with a lantern; a three-tiered gable at the middle of each roof;
 * the older keep in the north wing with its steep roof; and the terraces stepping down to the Main. Castle-local: the
 * river front faces +z. In assembly order: terraces, wings, towers, roofs, gables, and the caps last.
 */
function castle(): Piece[] {
  const solid = pieceMaterial();
  const box = unit(new THREE.BoxGeometry());
  const roof = prism();
  const octagon = unit(new THREE.CylinderGeometry(1, 1, 1, 8).rotateY(Math.PI / 8));
  const cap = haube();
  const spire = unit(new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4));
  const gables = gable();
  const facade = windowGrid(3, 8, 0.055, 0.17);
  const slits = windowGrid(5, 1, 0.22, 0.07);
  const y = PLINTH;
  /** Tower centres (the courtyard's outer corners), wing depth, eaves and the towers' square shafts. */
  const C = 3.4;
  const WING = 1.2;
  const WALL = 3.2;
  const TOWER = 5.8;
  const TW = 1.6;
  const pieces: Piece[] = [
    { shape: box, material: solid, colour: 'sandstoneShade', at: [0, 0, 0], size: [2 * C + 1.2, y, 2 * C + 1.2] },
    { shape: box, material: solid, colour: 'sandstoneShade', at: [0, 0, C + 1.1], size: [2 * C - 0.4, 0.85, 1] },
    { shape: box, material: solid, colour: 'sandstoneShade', at: [0, 0, C + 1.9], size: [2 * C - 2.4, 0.4, 0.7] },
  ];
  // A wing on each side (outward normal, and the turn that faces a piece that way); its windows grow with it.
  const sides: [nx: number, nz: number, turn: number][] = [
    [0, 1, 0],
    [1, 0, Math.PI / 2],
    [0, -1, Math.PI],
    [-1, 0, -Math.PI / 2],
  ];
  const mid = C + TW / 2 - WING / 2;
  for (const [nx, nz, turn] of sides) {
    pieces.push(
      { shape: box, material: solid, colour: 'mainSandstone', at: [nx * mid, y, nz * mid], size: [2 * C, WALL, WING], turn },
      { shape: facade, material: solid, colour: 'slate', at: [nx * mid, y, nz * mid], size: [2 * C - TW - 0.6, WALL, WING], turn },
    );
  }
  const corners = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ];
  for (const [sx, sz] of corners) {
    const at: [number, number, number] = [sx * C, y, sz * C];
    pieces.push(
      { shape: box, material: solid, colour: 'mainSandstone', at, size: [TW, TOWER, TW] },
      { shape: slits, material: solid, colour: 'slate', at, size: [TW, TOWER, TW], turn: sz > 0 ? 0 : Math.PI },
      { shape: slits, material: solid, colour: 'slate', at, size: [TW, TOWER, TW], turn: sx > 0 ? Math.PI / 2 : -Math.PI / 2 },
    );
  }
  for (const [sx, sz] of corners) {
    pieces.push(
      { shape: box, material: solid, colour: 'mainSandstone', at: [sx * C, y + TOWER, sz * C], size: [TW + 0.3, 0.18, TW + 0.3], drop: 1 },
      { shape: octagon, material: solid, colour: 'mainSandstone', at: [sx * C, y + TOWER + 0.18, sz * C], size: [TW - 0.15, 1.3, TW - 0.15] },
    );
  }
  // The keep, off-centre in the north wing: older than the rest, and not quite in step with it.
  const keep: [number, number, number] = [1, y, -mid];
  pieces.push({ shape: box, material: solid, colour: 'mainSandstone', at: keep, size: [1.5, 5.6, 1.5] });
  for (const [nx, nz, turn] of sides) {
    pieces.push({ shape: roof, material: solid, colour: 'slate', at: [nx * mid, y + WALL, nz * mid], size: [2 * C, 1.5, WING + 0.4], turn, drop: 1.2 });
  }
  pieces.push({ shape: spire, material: solid, colour: 'slate', at: [keep[0], y + 5.6, keep[2]], size: [1.7, 2.2, 1.7], drop: 1.5 });
  // Each wing's gable, its face flush with the wall's.
  const g = C + TW / 2 - 0.25;
  for (const [nx, nz, turn] of sides) {
    pieces.push({ shape: gables, material: solid, colour: 'mainSandstone', at: [nx * g, y + WALL, nz * g], size: [2, 2.1, 0.5], turn, drop: 1 });
  }
  for (const [sx, sz] of corners) {
    pieces.push({ shape: cap, material: solid, colour: 'slate', at: [sx * C, y + TOWER + 1.48, sz * C], size: [TW + 0.05, 2.5, TW + 0.05], drop: 1.5 });
  }
  return pieces;
}

/** Where a window is on the house: which wall, how far along it and up it, its size, its light and when it comes on. */
interface HouseWindow {
  /** The wall's outward yaw: 0 is the long side to the camera (+z), π/2 the gable to the road (+x). */
  face: number;
  u: number;
  y: number;
  w: number;
  h: number;
  light: PaletteKey;
  /** Local progress it comes on at. */
  on: number;
  /** The home office: a desk lamp, and a screen. */
  screen?: boolean;
  /** Metres its wall stands in from the house's (the dormer's face, set back up the roof). */
  inset?: number;
}

const G = 0.85;
const U = 2.2;
/**
 * The house coming back to life, a room at a time: the porch lamp as the car pulls up, the hall, the kitchen, the
 * living room, the landing; the office, where the Ciklum work is done from home, its screen on; the daughter's room,
 * the attic; and last the rooms at the back.
 */
const WINDOWS: HouseWindow[] = [
  { face: Math.PI / 2, u: 1.2, y: G, w: 0.8, h: 1.05, light: 'homeGlow', on: 0.33 },
  { face: 0, u: 1.55, y: G, w: 0.9, h: 1.05, light: 'candle', on: 0.37 },
  { face: 0, u: -0.3, y: 0.65, w: 1.5, h: 1.25, light: 'homeGlow', on: 0.41 },
  { face: Math.PI / 2, u: 0, y: U, w: 0.8, h: 0.9, light: 'homeGlow', on: 0.44 },
  { face: 0, u: -1.55, y: U, w: 0.9, h: 0.9, light: 'homeGlow', on: 0.46, screen: true },
  { face: 0, u: 1.55, y: U, w: 0.9, h: 0.9, light: 'candle', on: 0.53 },
  { face: 0, u: -0.4, y: 3.95, w: 0.75, h: 0.5, light: 'homeGlow', on: 0.57, inset: 0.15 },
  { face: Math.PI / 2, u: 0, y: 4, w: 0.5, h: 0.5, light: 'candle', on: 0.6 },
  { face: 0, u: -1.95, y: G, w: 0.55, h: 1.05, light: 'candle', on: 0.63 },
  { face: -Math.PI / 2, u: 0.9, y: U, w: 0.8, h: 0.9, light: 'homeGlow', on: 0.66 },
  { face: Math.PI, u: -0.8, y: G, w: 0.9, h: 1.05, light: 'candle', on: 0.69 },
];
/** The porch lamp by the front door, on as the car pulls up. */
const PORCH_ON = 0.3;
const SCREEN_ON = 0.48;
/** Dark glass before a room is lit. */
const DARK = new THREE.Color('#1a1f2a');

/** A wall's outward normal and its along-the-wall direction (right, seen from outside), house-local. */
function wall(face: number): { n: THREE.Vector3; t: THREE.Vector3; half: number } {
  const n = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
  return { n, t: new THREE.Vector3(Math.cos(face), 0, -Math.sin(face)), half: Math.abs(n.x) > 0.5 ? HD : HW };
}

/** A quad `out` m proud of a wall, `u` along it and centred `cy` up, w × h, house-local. */
function onWall(face: number, u: number, cy: number, w: number, h: number, out: number): THREE.BufferGeometry {
  const { n, t, half } = wall(face);
  const at = n.clone().multiplyScalar(half + out).addScaledVector(t, u).setY(cy);
  return new THREE.PlaneGeometry(w, h).rotateY(face).translate(at.x, at.y, at.z);
}

/**
 * A German family house: two storeys of pale render under a steep slate roof, a brick chimney, a dormer on the slope
 * to the camera, a canopy over the front door in the gable end, and a gravel drive out to the road. House-local:
 * its ridge runs along x, the front gable (+x) to the road.
 */
function house(): THREE.BufferGeometry {
  const roofShape = prism();
  const parts: [THREE.BufferGeometry, PaletteKey][] = [
    [new THREE.BoxGeometry(2 * HD + 0.1, 0.3, 2 * HW + 0.1).translate(0, 0.15, 0), 'concrete'],
    [new THREE.BoxGeometry(2 * HD, EAVE - 0.3, 2 * HW).translate(0, (EAVE + 0.3) / 2, 0), 'chalk'],
    [roofShape.clone().scale(2 * HD, RIDGE - EAVE - 0.25, 2 * HW).translate(0, EAVE, 0), 'chalk'],
    [roofShape.clone().scale(2 * HD + 0.6, RIDGE - EAVE, 2 * HW + 0.9).translate(0, EAVE - 0.18, 0), 'slate'],
    [new THREE.BoxGeometry(0.55, 2.2, 0.55).translate(CHIMNEY.x, RIDGE - 0.6, CHIMNEY.z), 'brick'],
    // The dormer on the camera's slope, and its little gable roof.
    [new THREE.BoxGeometry(1.2, 1, 1.2).translate(-0.4, 4.2, HW - 0.15 - 0.6), 'chalk'],
    [roofShape.clone().scale(1.5, 0.55, 1.5).rotateY(Math.PI / 2).translate(-0.4, 4.62, HW - 0.7), 'slate'],
    // The front door in the gable end, its canopy, and the step.
    [onWall(Math.PI / 2, -1.05, 1.05, 1, 2.1, 0.02), 'sandstoneShade'],
    [new THREE.BoxGeometry(0.9, 0.08, 1.6).translate(HD + 0.45, 2.35, 1.05), 'slate'],
    [new THREE.BoxGeometry(0.8, 0.18, 1.4).translate(HD + 0.4, 0.09, 1.05), 'concrete'],
    // The drive, out to the road's verge.
    [new THREE.BoxGeometry(2.5, 0.08, 2.4).translate(HD + 1.25, 0.04, 1.05), 'gravel'],
  ];
  // Dark frames behind the windows' glass.
  for (const { face, u, y, w, h, inset = 0 } of WINDOWS) parts.push([onWall(face, u, y + h / 2, w + 0.16, h + 0.16, 0.012 - inset), 'slate']);
  roofShape.dispose();
  return paint(parts);
}

/** The glass of every window, the dormer's among them, and the office screen, one quad each (6 vertices, in order). */
function panes(): THREE.BufferGeometry {
  const quads = WINDOWS.map(({ face, u, y, w, h, inset = 0 }) => onWall(face, u, y + h / 2, w, h, 0.025 - inset));
  const screen = WINDOWS.find((w) => w.screen)!;
  quads.push(onWall(screen.face, screen.u + 0.1, screen.y + 0.42, 0.5, 0.32, 0.04));
  const merged = mergeGeometries(quads.map((q) => q.toNonIndexed()));
  quads.forEach((q) => q.dispose());
  return merged.deleteAttribute('uv');
}

/** Spruce: a trunk and two stacked cones. Beech: a trunk and a faceted crown. Base at the origin, `h` m tall. */
function tree(conifer: boolean, h: number, x: number, z: number, crown: THREE.Color, trunk: THREE.Color): [THREE.BufferGeometry, THREE.Color][] {
  if (conifer)
    return [
      [new THREE.CylinderGeometry(0.1, 0.14, h * 0.25, 4).translate(x, h * 0.125, z), trunk],
      [new THREE.ConeGeometry(h * 0.24, h * 0.55, 6).translate(x, h * 0.45, z), crown],
      [new THREE.ConeGeometry(h * 0.17, h * 0.45, 6).translate(x, h * 0.77, z), crown.clone().offsetHSL(0, 0, 0.03)],
    ];
  return [
    [new THREE.CylinderGeometry(0.1, 0.16, h * 0.45, 4).translate(x, h * 0.225, z), trunk],
    [new THREE.IcosahedronGeometry(h * 0.25, 0).scale(1, 1.1, 1).translate(x, h * 0.66, z), crown],
  ];
}

/**
 * The forest the house stands at the edge of: spruce and beech on the near bank, off to the right behind the house
 * and closing over where the river bends away, and a few garden trees about the castle. Seeded, merged: one mesh.
 */
function forest(): THREE.BufferGeometry {
  const random = seeded(48);
  const parts: [THREE.BufferGeometry, THREE.Color][] = [];
  const spot = new THREE.Vector3();
  const plant = (s0: number, s1: number, t0: number, t1: number, count: number, conifers: number, h0: number, h1: number) => {
    for (let placed = 0, tries = 0; placed < count && tries < 400; tries++) {
      place(s0 + random() * (s1 - s0), t0 + random() * (t1 - t0), 0, spot);
      const conifer = random() < conifers;
      const h = h0 + random() * (h1 - h0);
      const r = h * (conifer ? 0.24 : 0.25);
      const [s, t] = framed(spot.x, spot.z);
      const inRiver = s < RIVER_END + 0.8 && t > RIVER_NEAR - r - 0.3 && t < RIVER_FAR + r + 0.3;
      const atHouse = Math.hypot(spot.x - HOUSE.x, spot.z - HOUSE.z) < 4.2 + r;
      const atCastle = Math.hypot(spot.x - CASTLE.x, spot.z - CASTLE.z) < 5.4 + r;
      if (
        inRiver ||
        atHouse ||
        atCastle ||
        Math.hypot(spot.x, spot.z) > 11.8 - r ||
        spot.x > roadside(spot.z) - r ||
        spot.z > 3.8 - r
      )
        continue;
      const crown = new THREE.Color(PALETTE[conifer ? 'spruce' : 'beech']).offsetHSL(
        (random() - 0.5) * 0.03,
        (random() - 0.5) * 0.1,
        (random() - 0.5) * 0.08,
      );
      parts.push(...tree(conifer, h, spot.x, spot.z, crown, new THREE.Color(PALETTE.sandstoneShade).offsetHSL(0, -0.25, -0.12)));
      placed++;
    }
  };
  // Behind the house to the right, deepening off toward the road's far side, and taller as it goes back.
  plant(5, 12, -1, 7, 30, 0.65, 3.8, 7);
  plant(4.4, 8, -3, 0.2, 7, 0.4, 3.4, 5.5);
  // The castle's garden trees, low beside it on the far bank.
  plant(-9, -6, 4, 9, 3, 0.2, 2.4, 3.4);
  plant(3, 5, 5, 9, 2, 0.3, 2.4, 3.6);
  return paint(parts);
}

/** Terrain height at (x, z): the near bank, the river bed under the water, and the far bank rising to the castle. */
function ground(x: number, z: number): number {
  const [s, t] = framed(x, z);
  const inRiver = smoothstep(RIVER_NEAR - 0.6, RIVER_NEAR + 0.4, t) * (1 - smoothstep(RIVER_FAR - 0.4, RIVER_FAR + 0.6, t));
  const river = inRiver * (1 - smoothstep(RIVER_END - 0.8, RIVER_END + 0.4, s));
  const far = 0.3 * smoothstep(RIVER_FAR, RIVER_FAR + 4, t);
  return -0.45 * river + far;
}

/** A low-poly ground of flat, faintly varied triangles: meadow on the banks, stones where the water is. */
function terrain(): THREE.BufferGeometry[] {
  const STEP = 2;
  const R = 12;
  const lift = (i: number, j: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return (n - Math.floor(n)) * 0.07;
  };
  const vertex = (i: number, j: number) => {
    const x = -R - 0.1 + i * STEP;
    const z = -R - 0.1 + j * STEP;
    return new THREE.Vector3(x, ground(x, z) + lift(i, j), z);
  };
  const random = seeded(4801);
  const near: number[][] = [[], []];
  const far: number[][] = [[], []];
  const colour = new THREE.Color();
  const n = (2 * R) / STEP;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const [a, b, c, d] = [vertex(i, j), vertex(i + 1, j), vertex(i + 1, j + 1), vertex(i, j + 1)];
      for (const tri of [
        [a, d, b],
        [b, d, c],
      ]) {
        if (tri.some((v) => Math.hypot(v.x, v.z) > 11.9 || v.x > roadside(v.z) - 0.2)) continue;
        // Two meshes, so that neither one's bounds reach into the road side (x > 4 and z > 4): what lies nearer than
        // z = 4, and what lies left of x = 4 beyond it. The grid's lines fall just short of 4.
        const nearSide = tri.every((v) => v.z < 4);
        const leftSide = tri.every((v) => v.x < 4);
        if (!nearSide && !leftSide) continue;
        const cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
        const cz = (tri[0].z + tri[1].z + tri[2].z) / 3;
        const wet = ground(cx, cz) < WATER + 0.05;
        colour.set(PALETTE[wet ? 'gravel' : 'meadow']).offsetHSL(0, (random() - 0.5) * 0.08, (random() - 0.5) * 0.07);
        const [position, colours] = nearSide ? near : far;
        for (const v of tri) {
          position.push(v.x, v.y, v.z);
          colours.push(colour.r, colour.g, colour.b);
        }
      }
    }
  return [near, far].map(([position, colours]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    g.computeVertexNormals();
    return g;
  });
}

/** The Main's surface: a band across the frame, its banks a little uneven, within the plot. */
function river(): THREE.BufferGeometry {
  const random = seeded(1614);
  const edge = (t: number, from: number, to: number) => {
    const out: THREE.Vector2[] = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const s = from + ((to - from) * i) / steps;
      const reach = Math.sqrt(Math.max(11.8 ** 2 - t * t, 0));
      const p = place(Math.max(Math.min(s, reach), -reach), t + (i > 0 && i < steps ? (random() - 0.5) * 0.4 : 0));
      out.push(new THREE.Vector2(p.x, -p.z));
    }
    return out;
  };
  const shape = new THREE.Shape([...edge(RIVER_NEAR, -12, RIVER_END), ...edge(RIVER_FAR, RIVER_END + 0.3, -12)]);
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, WATER, 0);
}

const MIST = 14;
const SMOKE = 10;
const SMOKE_RISE = 3.2;

/**
 * 2022–2024, Ciklum, in Aschaffenburg: where life was rebuilt after the escape. The F30 comes off the road from the
 * war and pulls up at a house at the edge of the forest; across the Main, Schloss Johannisburg. As the camera comes
 * in the castle goes up out of the river mist, block by block, in the red sandstone that is the first strong warm
 * colour since the war, and the house's windows light one by one: life coming back. One of them holds a small cool
 * screen: the job, done from home.
 */
export const ciklum: ChapterBuilder = () => {
  const object = new THREE.Group();
  const painted = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });

  const [nearBank, farBank] = terrain().map((g) => new THREE.Mesh(g, painted));
  const water = new THREE.MeshStandardMaterial({
    color: PALETTE.steel,
    flatShading: true,
    roughness: 0.3,
    metalness: 0.1,
    emissive: PALETTE.dawnBlue,
    emissiveIntensity: 0,
  });
  const main = new THREE.Mesh(river(), water);
  const trees = new THREE.Mesh(forest(), painted);

  // The house, turned to the road.
  const toHouse = new THREE.Matrix4().makeRotationY(HOUSE_YAW).scale(new THREE.Vector3().setScalar(HOUSE_SCALE)).setPosition(HOUSE);
  const home = new THREE.Mesh(house().applyMatrix4(toHouse), painted);
  const glass = panes().applyMatrix4(toHouse);
  const paneColour = new THREE.BufferAttribute(new Float32Array(glass.getAttribute('position').count * 3), 3);
  glass.setAttribute('color', paneColour);
  const windows = new THREE.Mesh(glass, new THREE.MeshBasicMaterial({ vertexColors: true }));
  windows.name = 'windows';

  // A glow at each window, the porch lamp and the screen: one set of points, lit from their colours.
  const glowAt: number[] = [];
  const centre = new THREE.Vector3();
  for (const { face, u, y, h } of WINDOWS) {
    const { n, t, half } = wall(face);
    centre.copy(n).multiplyScalar(half + 0.35).addScaledVector(t, u).setY(y + h / 2).applyMatrix4(toHouse);
    glowAt.push(centre.x, centre.y, centre.z);
  }
  const porch = new THREE.Vector3(HD + 0.35, 2.1, 1.05 + 0.75).applyMatrix4(toHouse);
  glowAt.push(porch.x, porch.y, porch.z);
  const office = WINDOWS.find((w) => w.screen)!;
  const { n, t, half } = wall(office.face);
  centre.copy(n).multiplyScalar(half + 0.3).addScaledVector(t, office.u + 0.1).setY(office.y + 0.58).applyMatrix4(toHouse);
  glowAt.push(centre.x, centre.y, centre.z);
  const halos = new THREE.BufferGeometry();
  halos.setAttribute('position', new THREE.Float32BufferAttribute(glowAt, 3));
  const haloColour = new THREE.BufferAttribute(new Float32Array(glowAt.length), 3);
  halos.setAttribute('color', haloColour);
  const glowing = { map: haloMap(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true };
  const glows = new THREE.Points(halos, new THREE.PointsMaterial({ ...glowing, size: 2.2 }));
  glows.frustumCulled = false;
  glows.renderOrder = 1;

  // Smoke from the chimney once the house is lived in: loops on time (idle only).
  const chimney = new THREE.Vector3(CHIMNEY.x, RIDGE + 0.5, CHIMNEY.z).applyMatrix4(toHouse);
  const smokePosition = new THREE.BufferAttribute(new Float32Array(SMOKE * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const smokeMaterial = new THREE.PointsMaterial({ color: PALETTE.chalk, map: haloMap(), size: 1.3, transparent: true, opacity: 0, depthWrite: false });
  const smoke = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', smokePosition), smokeMaterial);
  smoke.frustumCulled = false;

  // Mist on the river at first light, that the castle comes up out of and that lifts as it stands.
  const random = seeded(1605);
  const mistAt: number[] = [];
  for (let i = 0; i < MIST; i++) {
    const p = place(-10 + (i / (MIST - 1)) * (RIVER_END + 9) + (random() - 0.5), RIVER_NEAR + random() * (RIVER_FAR - RIVER_NEAR + 2.5), 0.5 + random() * 1.2);
    const r = Math.hypot(p.x, p.z);
    if (r > 11.5) p.multiplyScalar(11.5 / r).setY(0.8);
    mistAt.push(p.x, p.y, p.z);
  }
  const mistMaterial = new THREE.PointsMaterial({ color: PALETTE.chalk, map: haloMap(), size: 6, transparent: true, opacity: 0, depthWrite: false });
  const mist = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(mistAt, 3)), mistMaterial);
  mist.frustumCulled = false;
  mist.renderOrder = 1;

  const assembly = new Assembly(castle(), 4 / 44);
  assembly.object.position.copy(CASTLE);
  assembly.object.rotation.y = CASTLE_YAW;
  assembly.object.scale.setScalar(CASTLE_SCALE);

  // First light behind the castle: a wide cool dawn above, and the sun's warmth low on the horizon.
  const dawn = halo('dawnBlue', 34, 0);
  dawn.position.copy(place(-2, 14, 10));
  const sunrise = halo('dawnGold', 24, 0);
  sunrise.position.copy(place(-3, 18, 2));

  object.add(dawn, sunrise, nearBank, farBank, main, trees, home, windows, assembly.object, glows, smoke, mist);

  const lit = new THREE.Color();
  const screenGlow = new THREE.Color(PALETTE.screenGlow);
  const screenIndex = WINDOWS.findIndex((w) => w.screen);
  const warm = WINDOWS.map((w) => new THREE.Color(PALETTE[w.light]));
  const porchGlow = new THREE.Color(PALETTE.homeGlow);
  const setQuad = (quad: number, c: THREE.Color) => {
    for (let v = 0; v < 6; v++) paneColour.setXYZ(quad * 6 + v, c.r, c.g, c.b);
  };

  return {
    object,
    update({ local, time }) {
      const k = Math.min(Math.max((local - BUILD_FROM) / (BUILD_TO - BUILD_FROM), 0), 1);
      assembly.update(k);
      const calm = leave(local);

      // The windows, one room at a time; the office a dim desk lamp and, a moment later, the screen.
      WINDOWS.forEach((w, i) => {
        const on = smoothstep(w.on, w.on + 0.03, local) * (1 - 0.2 * calm);
        const dim = i === screenIndex ? 0.45 : 1;
        lit.copy(DARK).lerp(warm[i], on * dim);
        setQuad(i, lit);
        haloColour.setXYZ(i, warm[i].r * on * dim * 0.5, warm[i].g * on * dim * 0.5, warm[i].b * on * dim * 0.5);
      });
      const screen = smoothstep(SCREEN_ON, SCREEN_ON + 0.02, local) * (0.93 + 0.07 * Math.sin(time * 5.3) * Math.sin(time * 1.7));
      setQuad(WINDOWS.length, lit.copy(DARK).lerp(screenGlow, screen));
      const porchOn = smoothstep(PORCH_ON, PORCH_ON + 0.03, local) * 0.55;
      haloColour.setXYZ(WINDOWS.length, porchGlow.r * porchOn, porchGlow.g * porchOn, porchGlow.b * porchOn);
      haloColour.setXYZ(WINDOWS.length + 1, screenGlow.r * screen * 0.6, screenGlow.g * screen * 0.6, screenGlow.b * screen * 0.6);
      paneColour.needsUpdate = haloColour.needsUpdate = true;
      glows.visible = local > PORCH_ON;

      // The castle comes up out of the mist, which lifts as it stands; the water catches the dawn.
      mistMaterial.opacity = 0.22 * smoothstep(-0.4, 0.1, local) * (1 - smoothstep(0.35, 0.8, local));
      mist.visible = mistMaterial.opacity > 0;
      water.emissiveIntensity = 0.08 + 0.22 * smoothstep(0.2, 0.7, local);
      const light = smoothstep(0.1, 0.7, local) * (1 - 0.3 * calm);
      dawn.visible = sunrise.visible = light > 0;
      dawn.material.opacity = 0.25 * light;
      sunrise.material.opacity = 0.3 * light;

      // Smoke rises once the kitchen is lit; heights only ever come from time, so it never leaves the plot.
      smokeMaterial.opacity = 0.18 * smoothstep(0.44, 0.55, local);
      smoke.visible = smokeMaterial.opacity > 0;
      for (let i = 0; i < SMOKE; i++) {
        const f = (time * 0.12 + i / SMOKE) % 1;
        smokePosition.setXYZ(i, chimney.x - f * 0.9 + Math.sin(time * 0.7 + i) * 0.12, chimney.y + f * SMOKE_RISE, chimney.z + f * 0.5);
      }
      smokePosition.needsUpdate = true;
    },
  };
};
