import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Assembly, Piece, pieceMaterial, unit } from '../art/assembly';
import { halo, leave, lowPoly, smoothstep } from '../art/kit';
import { PALETTE, PaletteKey } from '../art/palette';
import { ChapterBuilder } from '../chapter-scene';

/** Screen-right and into the screen, seen from the camera road ((18, 7, 16) from the anchor), and where they cross. */
const ACROSS = new THREE.Vector3(16, 0, -18).normalize();
const DEPTH = new THREE.Vector3(-18, 0, -16).normalize();
const CENTRE = new THREE.Vector3(-1, 0, -2);
/** The yaw that squares a box to the camera's view. */
const SQUARE = Math.atan2(-ACROSS.z, ACROSS.x);

/** A point `s` m across the frame and `t` m into it, `y` m up, in the chapter's space. */
function place(s: number, t: number, y = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(CENTRE).addScaledVector(ACROSS, s).addScaledVector(DEPTH, t).setY(y);
}

/** The Main runs across the front of the frame, this far into it, and this wide. */
const RIVER = -3;
const RIVER_WIDTH = 2.6;

/** A plane's arc: a quadratic curve from `from` through toward `via` to `to`, flown over [start, end] of local progress. */
interface Arc {
  from: THREE.Vector3;
  via: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  end: number;
}

const ARCS: Arc[] = [
  // Out of Frankfurt, climbing across the frame.
  { from: place(-7.5, 4, 6), via: place(0, 6, 13), to: place(7.5, 4, 11.5), start: -0.35, end: 0.75 },
  // Coming in, descending the other way.
  { from: place(8, 2, 12), via: place(2, 5, 13.5), to: place(-7, 2, 7), start: 0.05, end: 1.05 },
  // High and far, crossing late.
  { from: place(-6, 6.5, 12), via: place(0, 9, 14), to: place(5, 6.5, 13), start: 0.3, end: 1.45 },
];
const TRAIL_POINTS = 40;
/** How far back along its arc a contrail stays bright. */
const TRAIL = 0.6;

/** The skyline rises over this stretch of local progress, as the camera comes in. */
const RISE_FROM = -0.55;
const RISE_TO = 0.3;

function bezier({ from, via, to }: Arc, u: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (1 - u) * (1 - u);
  const b = 2 * u * (1 - u);
  const c = u * u;
  return out.set(a * from.x + b * via.x + c * to.x, a * from.y + b * via.y + c * to.y, a * from.z + b * via.z + c * to.z);
}

function heading({ from, via, to }: Arc, u: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(
    (1 - u) * (via.x - from.x) + u * (to.x - via.x),
    (1 - u) * (via.y - from.y) + u * (to.y - via.y),
    (1 - u) * (via.z - from.z) + u * (to.z - via.z),
  ).normalize();
}

/** A low-poly airliner, nose along +x, about 2.8 m long: fuselage, nose, swept wings, fin and tailplane. */
function airliner(): THREE.BufferGeometry {
  // Swept back from the root; each side is its own shape so its faces keep their winding.
  const wing = (side: number) =>
    new THREE.ExtrudeGeometry(
      new THREE.Shape([[0.35, 0], [-0.25, 1.35], [-0.5, 1.35], [-0.35, 0]].map(([x, y]) => new THREE.Vector2(x, y * side))),
      { depth: 0.05, bevelEnabled: false },
    ).rotateX(Math.PI / 2);
  const parts = [
    new THREE.CylinderGeometry(0.17, 0.12, 2.3, 6).rotateZ(Math.PI / 2),
    new THREE.ConeGeometry(0.17, 0.45, 6).rotateZ(-Math.PI / 2).translate(1.37, 0, 0),
    wing(1),
    wing(-1),
    new THREE.BoxGeometry(0.45, 0.55, 0.05).translate(-1, 0.3, 0),
    new THREE.BoxGeometry(0.3, 0.04, 0.9).translate(-1.05, 0.05, 0),
  ];
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g).deleteAttribute('uv'));
  const merged = mergeGeometries(flat);
  new Set([...parts, ...flat]).forEach((g) => g.dispose());
  return merged;
}

/** Flat quads (y = `y`) between the given corners, as one geometry; corners go round each quad counter-clockwise from above. */
function quads(corners: THREE.Vector3[][], y: number): THREE.BufferGeometry {
  const position: number[] = [];
  for (const [a, b, c, d] of corners) for (const v of [a, b, c, a, c, d]) position.push(v.x, y, v.z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 2024–now, IATA in Frankfurt: the journey reaches today in full colour. A Frankfurt skyline rises block by block by
 * the Main, recognisable but not literal: the Messeturm's red shaft and pyramid, the Commerzbank's triangle with its
 * green sky gardens, the Main Tower's blue drum, the ECB's twin slabs by the river, the iron footbridge. Planes fly arcs
 * over it, drawing their contrails as the scroll goes on. Warm again: sandstone and wheat among the glass, and a gold
 * dawn behind the towers.
 */
export const iata: ChapterBuilder = () => {
  const object = new THREE.Group();
  const shapes = {
    box: unit(new THREE.BoxGeometry()),
    tri: unit(new THREE.CylinderGeometry(1, 1, 1, 3)),
    drum: unit(new THREE.CylinderGeometry(1, 1, 1, 8)),
    pyramid: unit(new THREE.ConeGeometry(1, 1, 4)),
  };
  const solid = pieceMaterial();
  const glass = pieceMaterial({ roughness: 0.35, metalness: 0.1 });
  const pieces: Piece[] = [];
  const at = new THREE.Vector3();
  /** A tower of `count` segments, each `h` m, of footprint w × d, standing at (s, t) from base y. */
  const tower = (
    shape: THREE.BufferGeometry,
    s: number,
    t: number,
    y: number,
    count: number,
    [w, h, d]: [number, number, number],
    colour: PaletteKey | ((i: number) => PaletteKey),
    material: THREE.Material = glass,
    turn = SQUARE,
  ) => {
    place(s, t, 0, at);
    for (let i = 0; i < count; i++) {
      const c = typeof colour === 'function' ? colour(i) : colour;
      pieces.push({ shape, material, colour: c, at: [at.x, y + i * h, at.z], size: [w, h, d], turn });
    }
    return y + count * h;
  };

  // Messeturm: a red shaft that steps in, under its pyramid.
  let top = tower(shapes.box, -6.3, 0.6, 0, 5, [1.7, 1.15, 1.7], 'terracotta', solid);
  top = tower(shapes.box, -6.3, 0.6, top, 3, [1.45, 1.05, 1.45], 'terracotta', solid);
  tower(shapes.pyramid, -6.3, 0.6, top, 1, [2.05, 1.7, 2.05], 'brick', solid, SQUARE + Math.PI / 4);
  // Commerzbank: the tallest, a triangle with a sky garden every few floors, a crown and a mast.
  top = tower(shapes.tri, -0.8, 1.6, 0, 8, [2.7, 1.3, 2.7], (i) => (i % 3 === 2 ? 'krakowRoof' : 'steel'));
  top = tower(shapes.tri, -0.8, 1.6, top, 1, [1.8, 0.7, 1.8], 'steel');
  tower(shapes.box, -0.8, 1.6, top, 1, [0.12, 1.3, 0.12], 'chalk', solid);
  // Main Tower: a blue glass drum beside a stone block, with a rim and a mast.
  tower(shapes.box, 3.4, 1.2, 0, 6, [1.4, 1.1, 1.4], 'sandstone', solid);
  top = tower(shapes.drum, 2.3, 0.4, 0, 8, [1.9, 1.15, 1.9], 'skyBlue');
  top = tower(shapes.drum, 2.3, 0.4, top, 1, [2.15, 0.25, 2.15], 'chalk', solid);
  tower(shapes.box, 2.3, 0.4, top, 1, [0.1, 1.8, 0.1], 'chalk', solid);
  // A slab tower behind, in the new world's blue.
  tower(shapes.box, -3.4, 3.2, 0, 7, [2.4, 1.05, 1.1], 'dawnBlue');
  // The ECB by the river: two glass slabs turned against each other.
  tower(shapes.box, 5.7, -0.5, 0, 7, [2.1, 1.05, 0.8], 'glass', glass, SQUARE + 0.25);
  tower(shapes.box, 6.8, -0.2, 0, 8, [2.1, 1.05, 0.8], 'glass', glass, SQUARE - 0.12);
  // The city around them: low and warm.
  const blocks: [s: number, t: number, w: number, h: number, colour: PaletteKey][] = [
    [-8, 2, 2, 2.5, 'wheat'],
    [-4.8, 0.2, 2.2, 3, 'chalk'],
    [-6, 4, 2, 4.5, 'chalk'],
    [-1.8, 4, 2.4, 4, 'sandstone'],
    [0.9, 3.4, 2, 3.5, 'chalk'],
    [4.4, 2.2, 2.4, 2.6, 'wheat'],
    [7, 2.4, 1.8, 3, 'sandstone'],
    [0.8, -0.9, 1.6, 2, 'wheat'],
    [-3.2, -0.7, 1.6, 1.6, 'sandstone'],
  ];
  for (const [s, t, w, h, colour] of blocks) tower(shapes.box, s, t, 0, 1, [w * 0.8, h * 0.8, w * 0.64], colour, solid);
  // The skyline rises together, level by level.
  pieces.sort((a, b) => a.at[1] - b.at[1]);
  const skyline = new Assembly(pieces, 8 / pieces.length);

  // The Main and its banks, split where the river crosses the middle so neither half reaches the road side.
  const bank = (s0: number, s1: number, t0: number, t1: number) => [place(s0, t0), place(s1, t0), place(s1, t1), place(s0, t1)];
  const riverMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.skyBlue, emissive: PALETTE.skyBlue, emissiveIntensity: 0, roughness: 0.25, metalness: 0.2, flatShading: true });
  const r0 = RIVER - RIVER_WIDTH / 2;
  const r1 = RIVER + RIVER_WIDTH / 2;
  const land: THREE.Mesh[] = [];
  for (const [s0, s1] of [[-8.8, 0], [0, 8.8]]) {
    land.push(
      new THREE.Mesh(quads([bank(s0, s1, r1, 4.8), bank(s0, s1, -6, r0)], 0.01), lowPoly('steel')),
      new THREE.Mesh(quads([bank(s0, s1, r0, r1)], 0.03), riverMaterial),
    );
  }
  // The iron footbridge: a deck and two low arches over the river.
  const deckAt = place(-3.5, RIVER, 0.45);
  const arch = new THREE.TorusGeometry(1.7, 0.07, 3, 8, Math.PI).scale(1, 0.45, 1).rotateY(Math.PI / 2);
  const footbridge = new THREE.Mesh(
    mergeGeometries(
      [new THREE.BoxGeometry(0.8, 0.12, RIVER_WIDTH + 1.2), arch.clone().translate(0.35, 0, 0), arch.clone().translate(-0.35, 0, 0)].map((g) =>
        g.toNonIndexed().deleteAttribute('uv'),
      ),
    ).rotateY(SQUARE),
    lowPoly('steel'),
  );
  arch.dispose();
  footbridge.position.copy(deckAt);
  land.forEach((m) => (m.visible = false));
  footbridge.visible = false;

  // Planes: one instanced mesh, each flying its arc; a contrail drawn behind each.
  const planes = new THREE.InstancedMesh(airliner(), lowPoly('chalk'), ARCS.length);
  planes.frustumCulled = false;
  const trails = ARCS.map((arc) => {
    const position: number[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < TRAIL_POINTS; i++) position.push(...bezier(arc, i / (TRAIL_POINTS - 1), p).toArray());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    line.frustumCulled = false;
    return line;
  });

  // Morning: a gold sun low behind the towers under a wide blue sky.
  const sky = halo('skyBlue', 40, 0);
  sky.position.copy(place(0, 9, 12));
  const sun = halo('dawnGold', 20, 0);
  sun.position.copy(place(-2, 10, 4));

  object.add(sky, sun, ...land, footbridge, skyline.object, planes, ...trails);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const nose = new THREE.Vector3(1, 0, 0);
  const trailColour = new THREE.Color(PALETTE.chalk);

  return {
    object,
    update({ local, time }) {
      const k = Math.min(Math.max((local - RISE_FROM) / (RISE_TO - RISE_FROM), 0), 1);
      skyline.update(k);
      const ground = smoothstep(0, 0.15, k);
      land.forEach((m) => (m.visible = ground > 0));
      footbridge.visible = k > 0.3;
      riverMaterial.emissiveIntensity = 0.25 * ground;
      const calm = leave(local);
      sky.visible = sun.visible = k > 0;
      sky.material.opacity = 0.3 * k * (1 - 0.3 * calm);
      sun.material.opacity = 0.5 * k * (1 - 0.3 * calm);

      ARCS.forEach((arc, i) => {
        const raw = (local - arc.start) / (arc.end - arc.start);
        const u = Math.min(Math.max(raw, 0), 1);
        const flying = raw > 0 && raw < 1;
        bezier(arc, u, position);
        heading(arc, u, direction);
        // Idle only: a slow bank and bob, never where on its arc it is.
        rotation.setFromUnitVectors(nose, direction).multiply(roll.setFromAxisAngle(nose, 0.12 * Math.sin(time * 0.6 + i * 2)));
        position.y += 0.08 * Math.sin(time * 0.9 + i);
        scale.setScalar(flying ? 0.85 : 0);
        planes.setMatrixAt(i, matrix.compose(position, rotation, scale));

        // The contrail: drawn up to the plane, fading behind it, then fading out once it has gone.
        const line = trails[i];
        const fade = raw > 0 ? 1 - smoothstep(1, 1.3, raw) : 0;
        line.visible = fade > 0;
        line.geometry.setDrawRange(0, Math.max(Math.floor(u * (TRAIL_POINTS - 1)) + 1, 2));
        const colour = line.geometry.getAttribute('color') as THREE.BufferAttribute;
        for (let p = 0; p < TRAIL_POINTS; p++) {
          const b = 0.55 * fade * (1 - Math.min((u - p / (TRAIL_POINTS - 1)) / TRAIL, 1));
          colour.setXYZ(p, trailColour.r * b, trailColour.g * b, trailColour.b * b);
        }
        colour.needsUpdate = true;
      });
      planes.instanceMatrix.needsUpdate = true;
    },
  };
};
