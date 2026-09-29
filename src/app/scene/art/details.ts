import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './kit';
import { PALETTE, PaletteKey } from './palette';

/**
 * The detail kit (#70): seeded builders for the secondary forms that make a set piece read as a real place (window
 * frames and sills, doors, cornices, balconies, fences, lamps, trees...). Every builder returns a painted geometry:
 * non-indexed, with a `color` attribute and no normals or uvs, standing on y = 0 and facing +z, so parts from many
 * builders merge (merge()) into one draw call of the shared paintedMaterial(). Place a part with place() before
 * merging. Same arguments, same seed: same geometry, on every load.
 *
 * A mesh flagged `userData.detail` (detailMesh()) is scenery on top of the structure: the war's shatter skips it
 * rather than breaking it, and it goes out with its chapter as the war starts.
 */

/** A palette colour, or any colour. */
export type Tint = PaletteKey | THREE.Color;

const scratch = new THREE.Color();

function colourOf(tint: Tint, out = scratch): THREE.Color {
  return tint instanceof THREE.Color ? out.copy(tint) : out.set(PALETTE[tint]);
}

/** A tint made lighter (> 1) or darker (< 1): for a shade of the same material. */
export function shade(tint: Tint, factor: number): THREE.Color {
  return colourOf(tint, new THREE.Color()).multiplyScalar(factor);
}

/**
 * Paints a geometry one colour, `shading` times: non-indexed, uv and normals dropped, a colour per vertex. Consumes
 * `geometry` (disposed when a copy was needed).
 */
export function paint(geometry: THREE.BufferGeometry, tint: Tint, shading = 1): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.deleteAttribute('uv');
  flat.deleteAttribute('normal');
  const c = colourOf(tint).multiplyScalar(shading);
  const count = flat.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(colours, i * 3);
  flat.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return flat;
}

/** Turns a part `rotation` radians about y, then moves it to (x, y, z). Returns the part. */
export function place(part: THREE.BufferGeometry, x: number, y: number, z: number, rotation = 0): THREE.BufferGeometry {
  if (rotation) part.rotateY(rotation);
  return part.translate(x, y, z);
}

/** Merges painted parts into one geometry with flat normals (for the shatter; the material shades flat anyway). Consumes the parts. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Merged parts come with normals; they are recomputed for the whole.
  parts.forEach((p) => p.deleteAttribute('normal'));
  const merged = parts.length
    ? mergeGeometries(parts)
    : paint(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3)), 'chalk');
  if (!merged) throw new Error('merge: every part must be painted (details.ts paint())');
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

let painted: THREE.MeshStandardMaterial | undefined;

/** The one flat-shaded vertex-coloured material every painted part shares: one shard batch for the whole world. */
export function paintedMaterial(): THREE.MeshStandardMaterial {
  painted ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
  return painted;
}

/** Marks an object as detail: the shatter skips it (and everything under it); it goes out as the war starts. */
export function asDetail<T extends THREE.Object3D>(object: T): T {
  object.userData['detail'] = true;
  return object;
}

/** A detail mesh of painted parts (merged) in `material` (by default paintedMaterial()). */
export function detailMesh(parts: THREE.BufferGeometry | THREE.BufferGeometry[], material: THREE.Material = paintedMaterial()): THREE.Mesh {
  return asDetail(new THREE.Mesh(Array.isArray(parts) ? merge(parts) : parts, material));
}

// ---------------------------------------------------------------------------------------------------------------------
// Primitives, plain (unpainted): the helpers lifted from krakow.ts and kharkiv-city.ts.

/** A gabled roof: a triangular prism along z with its base at y = 0 (from krakow.ts). */
export function gable(width: number, height: number, depth: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(1, 1, depth, 3)
    .rotateX(-Math.PI / 2)
    .scale(width / Math.sqrt(3), height / 1.5, 1)
    .translate(0, height / 3, 0);
}

/** A window rhythm on a wall: pane size, spacing, and the margins kept clear at the wall's edges (m). */
export interface PaneRhythm {
  w: number;
  h: number;
  dx: number;
  dy: number;
  /** Clear wall below the first row, above the last, before the first column and after the last. */
  bottom: number;
  top: number;
  start: number;
  end: number;
}

/**
 * Lower-left corners [u, y] of the panes a wall of `across` × `rise` (m, in its own plane) holds at a rhythm, each kept
 * with probability `share` by `random` (from kharkiv-city.ts's skyline windows).
 */
export function paneSlots(
  across: [number, number],
  rise: [number, number],
  rhythm: PaneRhythm,
  share = 1,
  random: () => number = () => 0,
): [number, number][] {
  const out: [number, number][] = [];
  for (let y = rise[0] + rhythm.bottom; y + rhythm.h < rise[1] - rhythm.top; y += rhythm.dy) {
    for (let u = across[0] + rhythm.start; u + rhythm.w < across[1] - rhythm.end; u += rhythm.dx) {
      if (random() > share) continue;
      out.push([u, y]);
    }
  }
  return out;
}

/**
 * A painted box w × h × d standing on y = 0, centred on x and z. `open` leaves out its underside, which nobody sees on
 * the ground and which the shatter would otherwise break too.
 */
export function box(w: number, h: number, d: number, tint: Tint, shading = 1, open = false): THREE.BufferGeometry {
  const g = paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), tint, shading);
  if (!open) return g;
  // BoxGeometry's faces run +x, -x, +y, -y, +z, -z; six vertices each once non-indexed. Drop -y.
  const keep = (a: THREE.BufferAttribute) => {
    const n = a.itemSize;
    const out = new Float32Array(30 * n);
    out.set(a.array.slice(0, 18 * n), 0);
    out.set(a.array.slice(24 * n, 36 * n), 18 * n);
    return new THREE.BufferAttribute(out, n);
  };
  g.setAttribute('position', keep(g.getAttribute('position') as THREE.BufferAttribute));
  g.setAttribute('color', keep(g.getAttribute('color') as THREE.BufferAttribute));
  return g;
}

/** Evenly spaced centres: `count` of them `spacing` apart, centred on `centre`. For window rhythms and posts. */
export function row(count: number, spacing: number, centre = 0): number[] {
  return Array.from({ length: count }, (_, i) => centre + (i - (count - 1) / 2) * spacing);
}

// ---------------------------------------------------------------------------------------------------------------------
// Facades. All on a wall face in the z = 0 plane, facing +z, x across and y up.

export interface WindowGridOptions {
  /** Window centres across the wall (m), in any rhythm: row() for even ones, or measured off a real facade. */
  columns: readonly number[];
  /** Sill heights (m), one per row of windows. */
  rows: readonly number[];
  width: number;
  height: number;
  /** Frame bar thickness (m); 0 draws the glass and sill alone (cheaper, for phones). Default 0.06. */
  frame?: number;
  /** Upright glazing bars per window. Default 1. */
  mullions?: number;
  /** A transom bar across the top third. Default true. */
  transom?: boolean;
  /** How far the sill stands out (m); 0 for none. Default 0.12. */
  sill?: number;
  /** A semicircular head over each window, as in a Gothic or Stalinist facade. */
  arched?: boolean;
  frameTint?: Tint;
  sillTint?: Tint;
  /** The unlit glass. */
  glassTint?: Tint;
  /** The lit glass, for a material that doesn't glow on its own (the glow material ignores it). */
  litTint?: Tint;
  /** Share of windows lit, picked by `seed`. Default 0.5. */
  lit?: number;
  seed?: number;
  /** Leaves a slot empty: a door below, a blank pier. */
  skip?: (column: number, row: number) => boolean;
}

/** A wall's windows: frames, sills and dark glass in one painted geometry, and the lit panes on their own for a glow material. */
export interface WindowGrid {
  frames: THREE.BufferGeometry;
  lit: THREE.BufferGeometry;
  /** How many windows were lit, and how many there are. */
  litCount: number;
  count: number;
}

/** Glass sits proud of the wall by this much (m): walls are solid, so windows are applied, not cut. */
const GLASS_Z = 0.015;

/** A pane of glass w × h with its lower edge on y = 0, optionally with a semicircular head. */
function glass(w: number, h: number, arched: boolean): THREE.BufferGeometry {
  const pane = new THREE.PlaneGeometry(w, h).translate(0, h / 2, GLASS_Z);
  if (!arched) return pane;
  const head = new THREE.CircleGeometry(w / 2, 6, 0, Math.PI).translate(0, h, GLASS_Z);
  const merged = mergeGeometries([pane.toNonIndexed(), head.toNonIndexed()]);
  pane.dispose();
  head.dispose();
  return merged;
}

/** Windows on a wall (see WindowGridOptions): seeded, so the same seed lights the same windows. */
export function windowGrid(options: WindowGridOptions): WindowGrid {
  const {
    columns,
    rows,
    width: w,
    height: h,
    frame = 0.06,
    mullions = 1,
    transom = true,
    sill = 0.12,
    arched = false,
    frameTint = 'chalk',
    sillTint = 'concrete',
    glassTint = 'ground',
    litTint = 'dawnGold',
    lit = 0.5,
    seed = 1,
    skip,
  } = options;
  const random = seeded(seed);
  const frames: THREE.BufferGeometry[] = [];
  const panes: THREE.BufferGeometry[] = [];
  let count = 0;
  rows.forEach((y, r) =>
    columns.forEach((x, c) => {
      // Drawn for every slot, skipped or not, so a skip never reshuffles which windows are lit.
      const on = random() < lit;
      if (skip?.(c, r)) return;
      count++;
      (on ? panes : frames).push(place(paint(glass(w, h, arched), on ? litTint : glassTint), x, y, 0));
      if (frame > 0) {
        const bar = (bw: number, bh: number, bx: number, by: number) => frames.push(place(box(bw, bh, frame, frameTint), x + bx, y + by, frame / 2));
        bar(w + frame * 2, frame, 0, -frame);
        if (!arched) bar(w + frame * 2, frame, 0, h);
        bar(frame, h, -(w + frame) / 2, 0);
        bar(frame, h, (w + frame) / 2, 0);
        for (let m = 1; m <= mullions; m++) bar(frame * 0.7, h, -w / 2 + (w * m) / (mullions + 1), 0);
        if (transom) bar(w, frame * 0.7, 0, h * 0.66);
        if (arched) frames.push(place(arch(w + frame, { thickness: frame, depth: frame, segments: 5, tint: frameTint }), x, y + h, 0));
      }
      if (sill > 0) frames.push(place(box(w + 0.1, 0.05, sill, sillTint), x, y - frame - 0.05, sill / 2));
    }),
  );
  return { frames: merge(frames), lit: merge(panes), litCount: panes.length, count };
}

/** An arch over a span: a ring of `segments` blocks from one springing to the other, springing at y = 0. */
export function arch(
  span: number,
  { thickness = 0.12, depth = 0.12, segments = 7, tint = 'chalk' as Tint }: { thickness?: number; depth?: number; segments?: number; tint?: Tint } = {},
): THREE.BufferGeometry {
  const radius = span / 2;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * (i + 0.5)) / segments;
    const length = 2 * (radius + thickness / 2) * Math.sin(Math.PI / (2 * segments)) + 0.01;
    const block = paint(new THREE.BoxGeometry(length, thickness, depth), tint);
    block.rotateZ(a - Math.PI / 2).translate(Math.cos(a) * radius, Math.sin(a) * radius, depth / 2);
    parts.push(block);
  }
  return merge(parts);
}

export interface DoorOptions {
  leafTint?: Tint;
  frameTint?: Tint;
  /** Two leaves rather than one. */
  double?: boolean;
  /** A glazed upper half, dark glass. */
  glazed?: boolean;
  glassTint?: Tint;
}

/** A door w × h on the wall: a frame, the leaves standing a little proud, glazed or plain. */
export function door(w: number, h: number, { leafTint = 'soot', frameTint = 'chalk', double = false, glazed = false, glassTint = 'ground' }: DoorOptions = {}): THREE.BufferGeometry {
  const f = 0.07;
  const parts = [
    place(box(f, h + f, 0.08, frameTint), -(w + f) / 2, 0, 0.04),
    place(box(f, h + f, 0.08, frameTint), (w + f) / 2, 0, 0.04),
    place(box(w + 2 * f, f, 0.08, frameTint), 0, h, 0.04),
  ];
  const leaves = double ? 2 : 1;
  const lw = w / leaves;
  for (let i = 0; i < leaves; i++) {
    const x = -w / 2 + lw * (i + 0.5);
    parts.push(place(box(lw - 0.02, h, 0.04, leafTint), x, 0, 0.02));
    if (glazed) parts.push(place(paint(new THREE.PlaneGeometry(lw * 0.7, h * 0.45), glassTint), x, h * 0.68, 0.045));
  }
  return merge(parts);
}

/** Entrance steps: `count` treads of `tread` (m) climbing to `height`, `width` wide, rising toward the wall (their back at z = 0). */
export function steps(width: number, count: number, height: number, tread = 0.3, tint: Tint = 'concrete'): THREE.BufferGeometry {
  const rise = height / count;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const depth = tread * (count - i);
    parts.push(place(box(width - i * 0.04, rise, depth, tint, 1 - i * 0.03), 0, i * rise, depth / 2));
  }
  return merge(parts);
}

/** A flat canopy `w` × `d` over a door, its soffit at `height`, on two posts at its front corners (or hung from the wall). */
export function canopy(w: number, d: number, height: number, { tint = 'chalk' as Tint, posts = true, slab = 0.16 } = {}): THREE.BufferGeometry {
  const parts = [place(box(w, slab, d, tint), 0, height, d / 2), place(box(w + 0.08, 0.05, d + 0.04, tint, 0.92), 0, height + slab, d / 2)];
  if (posts) for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) parts.push(place(box(0.1, height, 0.1, tint, 0.9), x, 0, d - 0.12));
  return merge(parts);
}

export interface CorniceOptions {
  /** Stepped tiers of the profile, each standing out further. Default 2. */
  tiers?: number;
  /** How far the last tier stands out (m). Default 0.16. */
  projection?: number;
  /** Total height (m). Default 0.24. */
  height?: number;
  tint?: Tint;
}

/** A cornice round a footprint w × d (centred on x and z), from y = 0 up: stepped tiers, each standing further out. */
export function cornice(w: number, d: number, { tiers = 2, projection = 0.16, height = 0.24, tint = 'chalk' }: CorniceOptions = {}): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const h = height / tiers;
  for (let i = 0; i < tiers; i++) {
    const out = (projection * (i + 1)) / tiers;
    parts.push(place(box(w + 2 * out, h, d + 2 * out, tint, 0.94 + (0.06 * i) / Math.max(tiers - 1, 1)), 0, i * h, 0));
  }
  return merge(parts);
}

/** A roof parapet round a footprint w × d, from y = 0: four low walls under a coping, and the roof deck inside. */
export function parapet(
  w: number,
  d: number,
  { height = 0.35, thickness = 0.14, tint = 'chalk' as Tint, coping = 'concrete' as Tint, deck = 'soot' as Tint } = {},
): THREE.BufferGeometry {
  const t = thickness;
  return merge([
    place(box(w, height, t, tint), 0, 0, (d - t) / 2),
    place(box(w, height, t, tint), 0, 0, -(d - t) / 2),
    place(box(t, height, d - 2 * t, tint), (w - t) / 2, 0, 0),
    place(box(t, height, d - 2 * t, tint), -(w - t) / 2, 0, 0),
    place(box(w + 0.06, 0.05, t + 0.06, coping), 0, height, (d - t) / 2),
    place(box(w + 0.06, 0.05, t + 0.06, coping), 0, height, -(d - t) / 2),
    place(box(t + 0.06, 0.05, d - 2 * t, coping), (w - t) / 2, height, 0),
    place(box(t + 0.06, 0.05, d - 2 * t, coping), -(w - t) / 2, height, 0),
    place(box(w - 2 * t, 0.04, d - 2 * t, deck), 0, 0, 0),
  ]);
}

/** Pilasters: shallow piers up a wall at each x, `height` tall, with a plinth block and a capital. */
export function pilasters(
  xs: readonly number[],
  height: number,
  { width = 0.3, depth = 0.1, tint = 'chalk' as Tint, capital = true } = {},
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of xs) {
    parts.push(place(box(width, height, depth, tint), x, 0, depth / 2));
    if (capital) {
      parts.push(place(box(width + 0.08, 0.1, depth + 0.05, tint, 1.05), x, height - 0.1, (depth + 0.05) / 2));
      parts.push(place(box(width + 0.06, 0.16, depth + 0.04, tint, 0.92), x, 0, (depth + 0.04) / 2));
    }
  }
  return merge(parts);
}

export interface BalconyOptions {
  depth?: number;
  /** Solid parapet panels (Soviet blocks) or open rails with balusters. Default 'panel'. */
  style?: 'panel' | 'rail';
  slabTint?: Tint;
  railTint?: Tint;
}

/** A balcony `w` wide off the wall: a slab and its guard, front and sides, the slab's top at y = 0. */
export function balcony(w: number, { depth = 0.8, style = 'panel', slabTint = 'concrete', railTint = 'chalk' }: BalconyOptions = {}): THREE.BufferGeometry {
  const h = 0.9;
  const parts = [place(box(w, 0.12, depth, slabTint), 0, -0.12, depth / 2)];
  if (style === 'panel') {
    parts.push(place(box(w, h, 0.05, railTint), 0, 0, depth - 0.025));
    for (const s of [-1, 1]) parts.push(place(box(0.05, h, depth - 0.05, railTint, 0.92), (s * (w - 0.05)) / 2, 0, (depth - 0.05) / 2));
  } else {
    parts.push(place(box(w, 0.05, 0.05, railTint), 0, h - 0.05, depth - 0.025));
    for (const x of row(Math.max(2, Math.round(w / 0.25)), w / Math.max(2, Math.round(w / 0.25)))) {
      parts.push(place(box(0.03, h - 0.05, 0.03, railTint), x, 0, depth - 0.025));
    }
    for (const s of [-1, 1]) parts.push(place(box(0.05, 0.05, depth, railTint), (s * (w - 0.05)) / 2, h - 0.05, depth / 2));
  }
  return merge(parts);
}

/** A chimney stack w × h × d with a projecting cap. */
export function chimney(w: number, h: number, d: number, { tint = 'brick' as Tint, capTint = 'concrete' as Tint } = {}): THREE.BufferGeometry {
  return merge([box(w, h, d, tint), place(box(w + 0.1, 0.08, d + 0.1, capTint), 0, h, 0)]);
}

/** A gabled roof w wide, `height` to the ridge, `depth` long (ridge along z), overhanging its walls by `overhang`. */
export function gabledRoof(w: number, height: number, depth: number, { tint = 'terracotta' as Tint, overhang = 0.2 } = {}): THREE.BufferGeometry {
  return paint(gable(w + 2 * overhang, height, depth + 2 * overhang), tint);
}

export interface TowerOptions {
  /** Sides of its plan: 4 square, 6 or 8 for a turret. Default 8. */
  sides?: number;
  roof?: 'cone' | 'dome' | 'pyramid' | 'flat';
  roofHeight?: number;
  tint?: Tint;
  roofTint?: Tint;
  /** A drum ring (belfry band) at this height. */
  band?: number;
}

/** A tower of `radius` and `height` (walls), with its roof: for spires, turrets, belfries, water towers. */
export function tower(radius: number, height: number, { sides = 8, roof = 'cone', roofHeight = radius * 2, tint = 'chalk', roofTint = 'krakowRoof', band }: TowerOptions = {}): THREE.BufferGeometry {
  const twist = Math.PI / sides;
  const parts = [paint(new THREE.CylinderGeometry(radius, radius, height, sides).rotateY(twist).translate(0, height / 2, 0), tint)];
  if (band !== undefined) parts.push(paint(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.15, sides).rotateY(twist).translate(0, band, 0), tint, 0.9));
  const top = height;
  if (roof === 'cone' || roof === 'pyramid') {
    const s = roof === 'pyramid' ? 4 : sides;
    parts.push(paint(new THREE.ConeGeometry(radius * 1.1, roofHeight, s).rotateY(roof === 'pyramid' ? Math.PI / 4 : twist).translate(0, top + roofHeight / 2, 0), roofTint));
  } else if (roof === 'dome') {
    parts.push(paint(new THREE.SphereGeometry(radius * 1.02, sides, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, roofHeight / radius, 1).translate(0, top, 0), roofTint));
  } else parts.push(place(box(radius * 2.1, 0.1, radius * 2.1, roofTint), 0, top, 0));
  return merge(parts);
}

// ---------------------------------------------------------------------------------------------------------------------
// Grounds and street furniture.

/** A diorama ground tile w × d: a slab `thickness` deep, its top at y = 0, its sides a shade darker. */
export function groundTile(w: number, d: number, { tint = 'meadow' as Tint, thickness = 0.25, edge = 0.72 } = {}): THREE.BufferGeometry {
  return merge([place(box(w, thickness - 0.02, d, tint, edge), 0, -thickness, 0), place(box(w - 0.04, 0.02, d - 0.04, tint), 0, -0.02, 0)]);
}

export interface FenceOptions {
  height?: number;
  /** Post spacing (m). Default 1.8. */
  spacing?: number;
  /** Pickets (wood), bars (steel railings) or rails alone (the cheapest, for phones). Default 'bars'. */
  style?: 'picket' | 'bars' | 'rail';
  /** Gaps for gates, each `width` wide centred `at` metres along the path; the gate's leaves stand open. */
  gates?: { at: number; width: number }[];
  tint?: Tint;
  postTint?: Tint;
}

/** A fence along a path of [x, z] points (m, on the ground). */
export function fence(path: readonly [number, number][], { height = 1, spacing = 1.8, style = 'bars', gates = [], tint = 'steel', postTint = 'ash' }: FenceOptions = {}): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const inGate = (s: number) => gates.some((g) => Math.abs(s - g.at) < g.width / 2);
  let along = 0;
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1];
    const [x1, z1] = path[i];
    const length = Math.hypot(x1 - x0, z1 - z0);
    const angle = Math.atan2(-(z1 - z0), x1 - x0);
    const at = (t: number): [number, number] => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
    const posts = Math.max(1, Math.round(length / spacing));
    for (let k = i === 1 ? 0 : 1; k <= posts; k++) {
      const s = along + (length * k) / posts;
      if (inGate(s)) continue;
      const [x, z] = at(k / posts);
      parts.push(place(box(0.08, height + 0.08, 0.08, postTint), x, 0, z));
    }
    // Rails and bars run between gates: split the segment where a gate cuts it.
    const cuts: [number, number][] = [[0, length]];
    for (const g of gates) {
      const a = g.at - g.width / 2 - along;
      const b = g.at + g.width / 2 - along;
      for (let c = cuts.length - 1; c >= 0; c--) {
        const [from, to] = cuts[c];
        if (b <= from || a >= to) continue;
        cuts.splice(c, 1, ...([[from, a], [b, to]] as [number, number][]).filter(([p, q]) => q - p > 0.05));
      }
    }
    for (const [from, to] of cuts) {
      const run = to - from;
      const [cx, cz] = at((from + to) / 2 / length);
      const rails = style === 'rail' ? [height * 0.45, height - 0.05] : [0.12, height - 0.08];
      for (const y of rails) parts.push(place(box(run, 0.05, 0.04, tint), cx, y, cz, angle));
      if (style === 'rail') continue;
      const gap = style === 'picket' ? 0.16 : 0.22;
      const n = Math.max(1, Math.floor(run / gap));
      for (let k = 0; k < n; k++) {
        const [px, pz] = at((from + ((k + 0.5) * run) / n) / length);
        const bar = style === 'picket' ? box(0.08, height - 0.05, 0.03, tint) : box(0.025, height - 0.1, 0.025, tint);
        parts.push(place(bar, px, 0.05, pz, angle));
      }
    }
    // Each gate in this segment: two stout posts and its two leaves, swung open into the yard (-z side of the path).
    for (const g of gates) {
      const t = (g.at - along) / length;
      if (t < 0 || t > 1) continue;
      for (const side of [-1, 1]) {
        const [px, pz] = at(t + (side * g.width) / 2 / length);
        parts.push(place(box(0.12, height + 0.25, 0.12, postTint), px, 0, pz));
        const leaf = box(g.width / 2 - 0.08, height - 0.15, 0.04, tint, 0.9).translate((-side * (g.width / 2 - 0.08)) / 2, 0.1, 0);
        parts.push(place(leaf, px, 0, pz, angle - side * 1.2));
      }
    }
    along += length;
  }
  return merge(parts);
}

/** A street lamp: `body` its pole and arm, `lamp` the lantern (for a glow material), `head` where the light is. */
export interface StreetLamp {
  body: THREE.BufferGeometry;
  lamp: THREE.BufferGeometry;
  head: THREE.Vector3;
}

/** A street lamp `height` tall; with an `arm` (m) it hangs its lantern out along +z (a Soviet-style bracket), else it tops the post. */
export function streetLamp({ height = 3.2, arm = 0.6, tint = 'ash' as Tint, lampTint = 'lastLight' as Tint } = {}): StreetLamp {
  const parts = [box(0.16, 0.3, 0.16, tint, 0.8), box(0.08, height, 0.08, tint)];
  const head = new THREE.Vector3(0, height, 0);
  if (arm > 0) {
    parts.push(place(box(0.06, 0.06, arm, tint), 0, height - 0.06, arm / 2));
    head.set(0, height - 0.2, arm);
  }
  parts.push(place(box(0.26, 0.12, 0.34, tint, 0.7), head.x, head.y + 0.08, head.z));
  const lamp = place(box(0.2, 0.08, 0.26, lampTint), head.x, head.y, head.z);
  lamp.computeVertexNormals();
  return { body: merge(parts), lamp, head };
}

/** A park bench `length` long, facing +z: slats on two legs, with a back. */
export function bench(length = 1.6, { tint = 'terracotta' as Tint, legTint = 'ash' as Tint, back = true } = {}): THREE.BufferGeometry {
  const parts = [place(box(length, 0.05, 0.4, tint), 0, 0.42, 0)];
  if (back) parts.push(place(box(length, 0.3, 0.05, tint, 0.9), 0, 0.55, -0.2));
  for (const x of [-length / 2 + 0.15, length / 2 - 0.15]) parts.push(place(box(0.06, 0.45, 0.42, legTint), x, 0, 0));
  return merge(parts);
}

// ---------------------------------------------------------------------------------------------------------------------
// Growing things and stones. Seeded: the seed picks the size, lean, crown and a small shift in colour.

/** A colour a little off `tint`, per seed: no two trees of a row are the same green. */
function vary(tint: Tint, random: () => number, amount = 0.1): THREE.Color {
  const c = colourOf(tint, new THREE.Color());
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h + (random() - 0.5) * amount * 0.3, hsl.s, Math.min(Math.max(hsl.l * (1 + (random() - 0.5) * amount * 2), 0), 1));
}

/** A low-poly lump: an icosahedron squashed to `sx` × `sy` × `sz`, its vertices nudged per seed. */
function lump(sx: number, sy: number, sz: number, random: () => number, tint: THREE.Color, jitter = 0.18, detail = 0): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  // Non-indexed: the same corner appears once per face. Nudge by position, so shared corners move together.
  const pos = g.getAttribute('position');
  const nudges = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let k = nudges.get(key);
    if (k === undefined) nudges.set(key, (k = 1 + (random() - 0.5) * 2 * jitter));
    pos.setXYZ(i, pos.getX(i) * k * sx, pos.getY(i) * k * sy, pos.getZ(i) * k * sz);
  }
  return paint(g, tint);
}

export type TreeKind = 'conifer' | 'broadleaf' | 'birch';

export interface TreeOptions {
  /** Height (m) before the seeded ±15%. Default 4. */
  height?: number;
  /** Fewer parts, for phones. */
  low?: boolean;
  foliage?: Tint;
}

/** A tree of a kind, standing on y = 0: its height, lean and crown seeded. */
export function tree(kind: TreeKind, seed: number, { height = 4, low = false, foliage }: TreeOptions = {}): THREE.BufferGeometry {
  const random = seeded(seed);
  const h = height * (0.85 + random() * 0.3);
  const parts: THREE.BufferGeometry[] = [];
  const lean = (random() - 0.5) * 0.12;
  if (kind === 'conifer') {
    const green = vary(foliage ?? 'spruce', random);
    parts.push(paint(new THREE.CylinderGeometry(0.08, 0.12, h * 0.3, 5).translate(0, h * 0.15, 0), 'soot', 1.4));
    const tiers = low ? 2 : 3;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers;
      const r = h * (0.28 - 0.18 * k) * (0.9 + random() * 0.2);
      const th = h * (0.55 - 0.1 * k);
      const cone = new THREE.ConeGeometry(r, th, low ? 5 : 7).rotateY(random() * Math.PI).translate(0, h * (0.2 + 0.25 * k) + th / 2, 0);
      parts.push(paint(cone, green, 1 - 0.06 * (tiers - 1 - i)));
    }
  } else if (kind === 'broadleaf') {
    const green = vary(foliage ?? 'beech', random);
    parts.push(paint(new THREE.CylinderGeometry(0.1, 0.16, h * 0.5, 5).translate(0, h * 0.25, 0), 'soot', 1.6));
    const blobs = low ? 1 : 3;
    for (let i = 0; i < blobs; i++) {
      const r = h * (i === 0 ? 0.3 : 0.2) * (0.85 + random() * 0.3);
      const a = random() * Math.PI * 2;
      const off = i === 0 ? 0 : h * 0.16;
      parts.push(place(lump(r, r * 0.85, r, random, green), Math.cos(a) * off, h * (i === 0 ? 0.68 : 0.58 + random() * 0.2), Math.sin(a) * off));
    }
  } else {
    // Birch: a slender white trunk marked dark, a light, loose crown.
    const green = vary(foliage ?? 'beech', random, 0.06).offsetHSL(0.03, 0, 0.08);
    const bands = low ? 1 : 3;
    for (let i = 0; i < bands; i++) {
      const bh = (h * 0.7) / bands;
      parts.push(paint(new THREE.CylinderGeometry(0.06, 0.08, bh, 5).translate(0, bh * (i + 0.5), 0), 'chalk', 1));
      if (!low) parts.push(paint(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 5).translate(0, bh * (i + 0.5) + (random() - 0.5) * 0.3, 0), 'soot', 1));
    }
    const blobs = low ? 1 : 2;
    for (let i = 0; i < blobs; i++) {
      const r = h * 0.17 * (0.85 + random() * 0.3);
      parts.push(place(lump(r, r * 1.6, r, random, green, 0.22), (random() - 0.5) * 0.3, h * (0.62 + 0.14 * i), (random() - 0.5) * 0.3));
    }
  }
  const merged = merge(parts);
  // Lean the whole tree a little from its foot.
  merged.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, lean, lean * 0.6, 0, 0));
  merged.computeVertexNormals();
  return merged;
}

/** A bush about `size` across, seeded. */
export function bush(seed: number, size = 0.9, tint: Tint = 'beech'): THREE.BufferGeometry {
  const random = seeded(seed);
  const green = vary(tint, random).multiplyScalar(0.85);
  const r = (size / 2) * (0.85 + random() * 0.3);
  return merge([place(lump(r, r * 0.7, r, random, green), 0, r * 0.55, 0), place(lump(r * 0.7, r * 0.55, r * 0.7, random, green.clone().multiplyScalar(1.08)), r * 0.5, r * 0.4, r * 0.2)]);
}

/** A rock about `size` across, seeded: a squat, faceted stone. */
export function rock(seed: number, size = 0.6, tint: Tint = 'gravel'): THREE.BufferGeometry {
  const random = seeded(seed);
  const r = size / 2;
  return merge([place(lump(r, r * (0.5 + random() * 0.3), r * (0.8 + random() * 0.3), random, vary(tint, random, 0.15), 0.28), 0, r * 0.25, 0)]);
}
