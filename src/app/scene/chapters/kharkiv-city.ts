import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  arcade,
  asDetail,
  box,
  detailMesh,
  gable,
  groundTile,
  merge,
  onion,
  paintedMaterial,
  paint,
  PaneRhythm,
  paneSlots,
  place,
  row,
  streetLamp,
  Tint,
  tree,
  windowGrid,
  WindowGrid,
} from '../art/details';
import { kharkivSkyline } from '../art/kharkiv';
import { lowPoly, seeded, smoothstep } from '../art/kit';
import { PaletteKey } from '../art/palette';
import { bakeAO, contactShadows } from '../art/shading';

export type SkylineTints = Record<'derzhprom' | 'panel-blocks' | 'brick-blocks', PaletteKey>;

/** A landmark of the skyline's dressing (#75): where it stands, when it rises, and its lit windows. */
interface Landmark {
  group: THREE.Group;
  delay: number;
  lit: THREE.Mesh;
}

/**
 * Kharkiv's skyline from #5, recoloured for a chapter, whose layers rise out of the ground one after another. Around it
 * (#75), as detail the war leaves out rather than breaks: Freedom Square in front of Derzhprom, with its fountain;
 * Derzhprom's glazing ribbons, road arches and red-and-white mast; the Karazin University tower, the Dormition bell
 * tower and the Annunciation Cathedral. Their lit windows glow in `glow`, from `rise(built, lit)`'s `lit` on.
 */
export function risingSkyline(tints: SkylineTints, glow: THREE.Material, phone = false) {
  const skyline = kharkivSkyline();
  const layers = skyline.children as THREE.Mesh[];
  for (const layer of layers) {
    layer.material = lowPoly(tints[layer.name as keyof SkylineTints]);
    layer.add(detailMesh(layer.name === 'derzhprom' ? derzhpromDetail(layer, phone) : blockDetail(layer, phone)));
  }
  const landmarks = [
    landmark(karazin(phone), glow, -6, 1.3, 0.1),
    landmark(dormition(phone), glow, -7.8, -6.4, 0.2),
    landmark(annunciation(phone), glow, 7.2, -7.2, 0.25),
  ];
  const square = freedomSquare(phone);
  skyline.add(square, ...landmarks.map((l) => l.group));
  // Derzhprom first, then the blocks around it.
  const order = ['derzhprom', 'panel-blocks', 'brick-blocks'];
  return {
    skyline,
    /** `built` is enter(local): 0 = nothing standing, 1 = the whole city up; `lit` > 0 once its windows are on. */
    rise(built: number, lit = 0): void {
      for (const layer of layers) {
        const delay = order.indexOf(layer.name) * 0.15;
        const k = smoothstep(delay, delay + 0.6, built);
        layer.visible = k > 0;
        // The footprint gathers in with the first of the rise, so a barely-started city is a
        // speck in the previous chapter's frame, not a full-width slab seen edge-on.
        const footprint = Math.max(smoothstep(0, 0.25, k), 1e-3);
        layer.scale.set(footprint, Math.max(k, 1e-3), footprint);
      }
      for (const { group, delay, lit: windows } of landmarks) {
        const k = smoothstep(delay, delay + 0.6, built);
        group.visible = k > 0;
        const footprint = Math.max(smoothstep(0, 0.25, k), 1e-3);
        group.scale.set(footprint, Math.max(k, 1e-3), footprint);
        windows.visible = lit > 0;
      }
      const spread = smoothstep(0, 0.35, built);
      square.visible = spread > 0;
      square.scale.set(Math.max(spread, 1e-3), 1, Math.max(spread, 1e-3));
    },
  };
}

const WINDOW: PaneRhythm = { w: 0.32, h: 0.45, dx: 0.8, dy: 1.05, bottom: 0.8, top: 0.3, start: 0.45, end: 0.3 };

/** A face of a skyline block the camera sees: a front (+z), a side (+x) or a roof, and its bounds. */
interface Face {
  facing: 'front' | 'side' | 'roof';
  box: THREE.Box3;
}

/** The camera-facing faces of a layer's merged boxes (non-indexed: every face is two triangles, six vertices), in order. */
function faces(layer: THREE.Mesh): Face[] {
  const out: Face[] = [];
  const pos = layer.geometry.getAttribute('position');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 6) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const facing = normal.z > 0.9 ? 'front' : normal.x > 0.9 ? 'side' : normal.y > 0.9 ? 'roof' : undefined;
    if (!facing) continue;
    const box = new THREE.Box3();
    for (let k = 0; k < 6; k++) box.expandByPoint(a.fromBufferAttribute(pos, i + k));
    out.push({ facing, box });
  }
  return out;
}

/** A face's extent across (x for a front, z for a side). */
const across = ({ facing, box }: Face): [number, number] => (facing === 'front' ? [box.min.x, box.max.x] : [box.min.z, box.max.z]);

/** A flat painted panel `w` × `h`, lower-left corner at `u`, `y` on a face, standing `out` proud of it. */
function onFace(face: Face, u: number, y: number, w: number, h: number, tint: Tint, out: number): THREE.BufferGeometry {
  const panel = paint(new THREE.PlaneGeometry(w, h), tint);
  if (face.facing === 'front') return panel.translate(u + w / 2, y + h / 2, face.box.max.z + out);
  return panel.rotateY(Math.PI / 2).translate(face.box.max.x + out, y + h / 2, u + w / 2);
}

/** A roof's coping: a slab a little wider than the roof, along its edge. */
function coping(face: Face, tint: Tint): THREE.BufferGeometry {
  const { min, max } = face.box;
  return place(box(max.x - min.x + 0.08, 0.07, max.z - min.z + 0.08, tint, 0.95), (min.x + max.x) / 2, max.y, (min.z + max.z) / 2);
}

/**
 * Derzhprom's dressing: constructivist glazing, one dark ribbon a floor across every face the camera sees (the lit panes
 * of skylineWindows() sit on them); its roofs' copings; road arches through the low links between its blocks; and the
 * red-and-white TV mast over the central tower.
 */
function derzhpromDetail(layer: THREE.Mesh, phone: boolean): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  let top = 0;
  for (const face of faces(layer)) {
    if (face.facing === 'roof') {
      // The mast's own stub (art/kharkiv.ts) is dressed below, with the rest of the mast.
      if (face.box.max.x - face.box.min.x < 0.5) continue;
      parts.push(coping(face, 'chalk'));
      top = Math.max(top, face.box.max.y);
      continue;
    }
    const [u0, u1] = across(face);
    const { min, max } = face.box;
    // The links between the blocks are low: the roads pass through them under an arch.
    if (face.facing === 'front' && max.y < 2) {
      parts.push(place(arcade(u1 - u0 - 0.3, 1, 0.8, { pier: 0.14, tint: 'chalk', shadow: 'night' }), (u0 + u1) / 2, min.y, max.z));
      continue;
    }
    const width = u1 - u0 - WINDOW.start - WINDOW.end + 0.16;
    if (width < 0.3) continue;
    for (let y = min.y + WINDOW.bottom; y + WINDOW.h < max.y - WINDOW.top; y += WINDOW.dy) {
      parts.push(onFace(face, u0 + WINDOW.start - 0.08, y - 0.04, width, WINDOW.h + 0.08, 'slate', 0.015));
    }
  }
  // The mast: a tapering lattice in red and white bands, over the tallest roof.
  const bands = phone ? 3 : 5;
  const height = 2.1;
  for (let i = 0; i < bands; i++) {
    const r0 = 0.26 - (0.14 * i) / bands;
    const r1 = 0.26 - (0.14 * (i + 1)) / bands;
    const h = height / bands;
    parts.push(paint(new THREE.CylinderGeometry(r1, r0, h, 4, 1, true).rotateY(Math.PI / 4).translate(0, top + h * (i + 0.5), -2.1), i % 2 ? 'chalk' : 'brick'));
  }
  parts.push(place(box(0.03, 0.5, 0.03, 'chalk'), 0, top + height, -2.1));
  return parts;
}

/** The blocks around Derzhprom: every window slot dark (the lit ones sit over them), copings, lift housings and aerials. */
function blockDetail(layer: THREE.Mesh, phone: boolean): THREE.BufferGeometry[] {
  const random = seeded(layer.name.length * 31);
  const parts: THREE.BufferGeometry[] = [];
  for (const face of faces(layer)) {
    const { min, max } = face.box;
    if (face.facing === 'roof') {
      parts.push(coping(face, 'concrete'));
      const x = (min.x + max.x) / 2 + (random() - 0.5) * 0.6;
      const z = (min.z + max.z) / 2 + (random() - 0.5) * 0.4;
      parts.push(place(box(0.5, 0.35, 0.45, 'concrete', 0.9), x, max.y + 0.07, z));
      if (!phone || random() < 0.5) parts.push(place(box(0.03, 0.6 + random() * 0.5, 0.03, 'ash'), x + 0.35, max.y + 0.07, z - 0.1));
      continue;
    }
    for (const [u, y] of paneSlots(across(face), [min.y, max.y], WINDOW)) parts.push(onFace(face, u, y, WINDOW.w, WINDOW.h, 'slate', 0.015));
  }
  return parts;
}

/** A landmark built at its origin, as painted structure and lit panes, set on its site and given its own lit mesh. */
function landmark({ structure, lit }: { structure: THREE.BufferGeometry; lit: THREE.BufferGeometry }, glow: THREE.Material, x: number, z: number, delay: number): Landmark {
  const group = asDetail(new THREE.Group());
  group.position.set(x, 0, z);
  const windows = new THREE.Mesh(lit, glow);
  group.add(new THREE.Mesh(bakeAO(structure, { corner: 0 }), paintedMaterial()), windows);
  return { group, delay, lit: windows };
}

/** Windows of a wall, turned `rotation` about y and set at (x, z): frames and dark glass to `frames`, lit panes to `lit`. */
function wall(grid: WindowGrid, frames: THREE.BufferGeometry[], lit: THREE.BufferGeometry[], x: number, y: number, z: number, rotation = 0): void {
  frames.push(place(grid.frames, x, y, z, rotation));
  lit.push(place(grid.lit, x, y, z, rotation));
}

/** A drum of `radius` from `y0` to `y1` in horizontal bands of two tints, as the Annunciation's walls are striped. */
function striped(radius: number, sides: number, y0: number, y1: number, bands: number, tints: [Tint, Tint], square = false): THREE.BufferGeometry[] {
  const h = (y1 - y0) / bands;
  return Array.from({ length: bands }, (_, i) => {
    const tint = tints[i % 2];
    const y = y0 + i * h;
    return square ? place(box(radius * 2, h, radius * 2, tint), 0, y, 0) : paint(new THREE.CylinderGeometry(radius, radius, h, sides).translate(0, y + h / 2, 0), tint);
  });
}

/**
 * The Karazin University main building, Freedom Square 4 (1929–32, rebuilt 1950s–61): a square tower of 14 floors,
 * about 66 m, stepping in at its top and flat-roofed (the spire was never built), over long low wings with taller end
 * blocks, all in beige ceramic tile. Its tower at the origin; one wing runs west, one toward the camera.
 */
function karazin(phone: boolean) {
  const tile: Tint = 'crtBeige';
  const structure: THREE.BufferGeometry[] = [
    box(1.5, 7.4, 1.5, tile),
    place(box(1.15, 0.9, 1.15, tile, 0.96), 0, 7.4, 0),
    place(box(0.75, 0.5, 0.75, tile, 0.92), 0, 8.3, 0),
    place(box(1.6, 0.08, 1.6, tile, 0.85), 0, 7.4, 0),
    place(box(1.5, 2.3, 0.9, tile, 0.97), -1.5, 0, -0.3),
    place(box(0.7, 3, 1, tile), -2.2, 0, -0.3),
    place(box(0.8, 2.3, 1.4, tile, 0.97), 0.6, 0, 1.45),
    place(box(0.9, 3, 0.6, tile), 0.6, 0, 1.85),
    place(box(0.03, 0.8, 0.03, 'ash'), 0.2, 8.8, 0.1),
    place(box(0.03, 0.55, 0.03, 'ash'), -0.2, 8.8, -0.15),
  ];
  const frames: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const bare = { frame: 0, sill: phone ? 0 : 0.05, mullions: 0, transom: false, glassTint: 'ground' as Tint };
  const floors = Array.from({ length: 8 }, (_, i) => 0.55 + i * 0.85);
  const tower = (seed: number) => windowGrid({ columns: row(3, 0.42), rows: floors, width: 0.22, height: 0.45, lit: 0.35, seed, ...bare });
  wall(tower(66), frames, lit, 0, 0, 0.75);
  wall(tower(67), frames, lit, 0.75, 0, 0, Math.PI / 2);
  wall(windowGrid({ columns: row(2, 0.45, -1.3), rows: [0.5, 1.3], width: 0.22, height: 0.4, lit: 0.4, seed: 68, ...bare }), frames, lit, 0, 0, 0.15);
  wall(windowGrid({ columns: row(2, 0.4), rows: [0.5, 1.3], width: 0.22, height: 0.4, lit: 0.4, seed: 69, ...bare }), frames, lit, 1, 0, 1.1, Math.PI / 2);
  return { structure: merge([...structure, ...frames]), lit: merge(lit) };
}

/**
 * The Dormition Cathedral's bell tower on University Hill (1820s–30s, 90 m): white and neoclassical, a pedimented
 * base, round tiers ringed with columns, a clock tier and a gilded onion under its cross.
 */
function dormition(phone: boolean) {
  const white: Tint = 'chalk';
  const sides = phone ? 6 : 10;
  const parts: THREE.BufferGeometry[] = [
    box(1.5, 2.4, 1.5, white),
    place(paint(gable(1.6, 0.45, 0.2), white, 0.94), 0, 2.4, 0.7),
    place(box(1.1, 1.6, 1.1, white, 0.97), 0, 2.4, 0),
    place(box(1.2, 0.08, 1.2, white, 0.88), 0, 4, 0),
    paint(new THREE.CylinderGeometry(0.5, 0.5, 1.4, sides).translate(0, 4.7, 0), white),
    paint(new THREE.CylinderGeometry(0.58, 0.58, 0.08, sides).translate(0, 5.44, 0), white, 0.88),
    paint(new THREE.CylinderGeometry(0.42, 0.42, 1.1, sides).translate(0, 6.03, 0), white),
    paint(new THREE.CylinderGeometry(0.36, 0.36, 0.7, sides).translate(0, 6.93, 0), white, 0.96),
    place(onion(0.42, 1, { sides: phone ? 6 : 8 }), 0, 7.28, 0),
    paint(new THREE.ConeGeometry(0.05, 0.5, 4).translate(0, 8.5, 0), 'dawnGold'),
    place(box(0.03, 0.3, 0.03, 'dawnGold'), 0, 8.7, 0),
    place(box(0.18, 0.03, 0.03, 'dawnGold'), 0, 8.88, 0),
  ];
  // The clock, on the faces the camera sees.
  for (const turn of [0, Math.PI / 2]) parts.push(place(paint(new THREE.CircleGeometry(0.14, 8), 'lastLight'), 0, 6.93, 0.37, turn));
  const frames: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  if (!phone) {
    // Columns round the base's portico and the two round tiers.
    for (const x of row(4, 0.4)) parts.push(place(box(0.1, 2.2, 0.1, white, 1.05), x, 0.1, 0.82));
    for (const [r, y0, h] of [[0.56, 4, 1.4], [0.48, 5.48, 1.05]])
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        parts.push(place(box(0.07, h, 0.07, white, 1.06), Math.sin(a) * r, y0, Math.cos(a) * r));
      }
  }
  // The belfry openings, dark and arched, and the lit windows of the base.
  wall(windowGrid({ columns: [0], rows: [4.35], width: 0.22, height: 0.55, arched: true, lit: 0, frame: 0, sill: 0 }), frames, lit, 0, 0, 0.5);
  wall(windowGrid({ columns: [0], rows: [5.7], width: 0.2, height: 0.5, arched: true, lit: 0, frame: 0, sill: 0 }), frames, lit, 0, 0, 0.42);
  wall(windowGrid({ columns: row(2, 0.5), rows: [2.8], width: 0.22, height: 0.6, arched: true, lit: 1, seed: 90, frame: 0, sill: 0 }), frames, lit, 0, 0, 0.55);
  return { structure: merge([...parts, ...frames]), lit: merge(lit) };
}

/**
 * The Annunciation Cathedral (1888–1901, M. Lovtsov): neo-Byzantine, candy-striped in red brick and cream, a big drum
 * ringed with arched windows under a green-grey ribbed dome, four smaller domed drums at its corners, and at its west
 * end a tiered bell tower with a dark tented spire and a gilded cross. Its body at the origin, the bell tower behind it.
 */
function annunciation(phone: boolean) {
  const stripes: [Tint, Tint] = ['brick', 'crtBeige'];
  const sides = phone ? 8 : 12;
  const dome = (r: number, y: number) =>
    paint(new THREE.SphereGeometry(r, phone ? 8 : 12, phone ? 3 : 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, y, 0), 'krakowRoof', 0.8);
  const cross = (x: number, y: number, z: number, s = 1) => [
    place(onion(0.06 * s, 0.14 * s, { sides: 5 }), x, y, z),
    place(box(0.025 * s, 0.34 * s, 0.025 * s, 'dawnGold'), x, y + 0.12 * s, z),
    place(box(0.16 * s, 0.025 * s, 0.025 * s, 'dawnGold'), x, y + 0.34 * s, z),
  ];
  const parts: THREE.BufferGeometry[] = [
    ...striped(1, 4, 0, 1.7, 5, stripes, true),
    ...striped(0.62, sides, 1.7, 2.6, 3, stripes),
    dome(0.68, 2.6),
    ...cross(0, 3.26, 0, 1.4),
  ];
  for (const [x, z] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) {
    parts.push(...striped(0.26, phone ? 6 : 8, 1.7, 2.2, 2, stripes).map((g) => g.translate(x, 0, z)));
    parts.push(dome(0.28, 2.2).translate(x, 0, z));
    if (!phone) parts.push(...cross(x, 2.46, z, 0.7));
  }
  // The bell tower: striped square tiers, an octagonal lantern, the dark tented spire.
  const bell = [
    ...striped(0.4, 4, 0, 2.4, 7, stripes, true),
    ...striped(0.32, 4, 2.4, 3.6, 3, stripes, true),
    paint(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8).translate(0, 3.85, 0), 'crtBeige'),
    paint(new THREE.ConeGeometry(0.36, 1.6, 8).translate(0, 4.9, 0), 'slate'),
    ...cross(0, 5.7, 0, 1.2),
  ].map((g) => g.translate(0, 0, -1.3));
  parts.push(...bell);
  const frames: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  // Arched windows: the drum's ring (as the camera sees it, front and side), the body's, the bell tower's.
  const drum = (seed: number) => windowGrid({ columns: row(3, 0.3), rows: [1.9], width: 0.14, height: 0.4, arched: true, lit: 0.6, seed, frame: 0, sill: 0 });
  wall(drum(1), frames, lit, 0, 0, 0.63);
  wall(drum(2), frames, lit, 0.63, 0, 0, Math.PI / 2);
  const body = (seed: number) => windowGrid({ columns: row(3, 0.55), rows: [0.45], width: 0.22, height: 0.6, arched: true, lit: 0.5, seed, frame: 0, sill: 0 });
  wall(body(3), frames, lit, 0, 0, 1);
  wall(body(4), frames, lit, 1, 0, 0, Math.PI / 2);
  wall(windowGrid({ columns: [0], rows: [2.9], width: 0.18, height: 0.5, arched: true, lit: 0, frame: 0, sill: 0 }), frames, lit, 0.41, 0, -1.3, Math.PI / 2);
  return { structure: merge([...parts, ...frames]), lit: merge(lit) };
}

/**
 * Freedom Square in front of Derzhprom: paving, lawns either side of its axis, the round fountain (2020) on it, and
 * contact shadows under the buildings. Trees and lamps line the lawns on desktops.
 */
function freedomSquare(phone: boolean): THREE.Group {
  const sides = phone ? 12 : 20;
  const ground = [
    place(groundTile(16.7, 11.8, { tint: 'gravel' }), -0.25, 0, -2.4),
    place(paint(new THREE.PlaneGeometry(2.3, 2.4).rotateX(-Math.PI / 2), 'meadow'), -2.2, 0.01, 1.9),
    place(paint(new THREE.PlaneGeometry(2.3, 2.4).rotateX(-Math.PI / 2), 'meadow'), 2.2, 0.01, 1.9),
    // The fountain: a granite rim, the water, and its jets.
    paint(new THREE.CylinderGeometry(0.9, 0.95, 0.18, sides, 1, true).translate(0, 0.09, 1.9), 'concrete', 1.2),
    paint(new THREE.CircleGeometry(0.9, sides).rotateX(-Math.PI / 2).translate(0, 0.12, 1.9), 'steel'),
  ];
  const jets = phone ? [[0, 0]] : [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]];
  for (const [x, z] of jets) ground.push(paint(new THREE.ConeGeometry(0.05, x || z ? 0.4 : 0.7, 4).translate(x, 0.12 + (x || z ? 0.2 : 0.35), 1.9 + z), 'lastLight'));
  if (!phone) {
    const lamp = streetLamp({ height: 1.6, arm: 0 });
    for (const x of [-1.1, 1.1]) ground.push(place(lamp.body.clone(), x, 0, 3.1), place(lamp.lamp.clone(), x, 0, 3.1));
    lamp.body.dispose();
    lamp.lamp.dispose();
    ground.push(place(tree('broadleaf', 21, { height: 2.1 }), -2.7, 0, 2.4), place(tree('broadleaf', 22, { height: 1.9 }), 2.8, 0, 2.5));
  }
  const square = asDetail(new THREE.Group());
  square.add(
    detailMesh(bakeAO(merge(ground), { corner: 0 })),
    contactShadows(
      [
        { x: 0, z: -2.1, w: 11, d: 4.2 },
        { x: 6.8, z: -7.2, w: 3, d: 2.2 },
        { x: -7.8, z: -6.4, w: 2.4, d: 2.4 },
        { x: -6.6, z: 1.8, w: 3.6, d: 2.6 },
        { x: 1, z: -5.2, w: 12, d: 3 },
      ],
      { opacity: 0.45 },
    ),
  );
  return square;
}

/**
 * Window panes on the skyline's camera-facing walls (+z fronts and +x sides), as one merged
 * geometry for a glow mesh. `share` is the fraction lit; the pick is seeded.
 */
export function skylineWindows(
  skyline: THREE.Group,
  share: number,
  seed: number,
): THREE.BufferGeometry {
  const random = seeded(seed);
  const panes: THREE.BufferGeometry[] = [];
  for (const layer of skyline.children) {
    if (!(layer instanceof THREE.Mesh)) continue;
    for (const face of faces(layer)) {
      if (face.facing === 'roof') continue;
      // Derzhprom's low links carry road arches, not windows (derzhpromDetail()).
      if (layer.name === 'derzhprom' && face.facing === 'front' && face.box.max.y < 2) continue;
      const { box } = face;
      for (const [u, y] of paneSlots(across(face), [box.min.y, box.max.y], WINDOW, share, random)) {
        const pane = new THREE.PlaneGeometry(WINDOW.w, WINDOW.h);
        if (face.facing === 'front') pane.translate(u + WINDOW.w / 2, y + WINDOW.h / 2, box.max.z + 0.03);
        else
          pane
            .rotateY(Math.PI / 2)
            .translate(box.max.x + 0.03, y + WINDOW.h / 2, u + WINDOW.w / 2);
        panes.push(pane);
      }
    }
  }
  const merged = mergeGeometries(panes);
  panes.forEach((p) => p.dispose());
  return merged;
}
