import * as THREE from 'three';
import { box, lump, merge, paint, place, Tint, vary } from './details';
import { seeded } from './kit';

/**
 * More of the detail kit (#74): rooms and people. Same rules as details.ts: painted, non-indexed, standing on y = 0,
 * facing +z, seeded. Sizes are real metres; a set piece built larger than life scales the part (geometry.scale()).
 */

const Z = new THREE.Vector3(0, 0, 1);

/** A square rod `thickness` thick from `a` to `b`: an arm, a leg, a length of cable. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, thickness: number, tint: Tint): THREE.BufferGeometry {
  const along = new THREE.Vector3().subVectors(b, a);
  const length = along.length();
  const g = paint(new THREE.BoxGeometry(thickness, thickness, length + thickness * 0.5), tint);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, along.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

/** A cable through `points`, `thickness` thick. */
export function cable(points: readonly THREE.Vector3[], thickness = 0.02, tint: Tint = 'soot'): THREE.BufferGeometry {
  return merge(points.slice(1).map((p, i) => rod(points[i], p, thickness, tint)));
}

/** `segments` + 1 points of a cable hanging from `a` to `b`, sagging `sag` below the straight line at its middle. */
export function droop(a: THREE.Vector3, b: THREE.Vector3, sag: number, segments = 4): THREE.Vector3[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    return new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
  });
}

/** A room's corner: a floor w × d, a back wall along its -z edge and a side wall along its -x edge, `height` tall, skirted. */
export function roomCorner(
  w: number,
  d: number,
  height: number,
  { floor = 'brass' as Tint, wall = 'chalk' as Tint, skirting = 'soot' as Tint, thickness = 0.2, skirt = 0.3 } = {},
): THREE.BufferGeometry {
  const t = thickness;
  return merge([
    place(box(w, t - 0.02, d, floor, 0.72, true), 0, -t, 0),
    place(box(w - 0.04, 0.02, d - 0.04, floor), 0, -0.02, 0),
    place(box(w, height, t, wall, 1, true), 0, 0, -(d + t) / 2),
    place(box(t, height, d + t, wall, 0.9, true), -(w + t) / 2, 0, -t / 2),
    place(box(w, skirt, 0.06, skirting), 0, 0, -d / 2 + 0.03),
    place(box(0.06, skirt, d, skirting), -w / 2 + 0.03, 0, 0),
  ]);
}

/** A chair facing +z, seat 0.45 m up: a wooden kitchen chair or an office chair on five castors. */
export function chair(style: 'wooden' | 'office' = 'wooden', { tint = 'brass' as Tint, frameTint = 'soot' as Tint } = {}): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (style === 'wooden') {
    for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) parts.push(place(box(0.04, 0.43, 0.04, tint, 0.85), x, 0, z));
    parts.push(place(box(0.42, 0.04, 0.42, tint), 0, 0.43, 0));
    for (const x of [-0.18, 0.18]) parts.push(place(box(0.04, 0.46, 0.04, tint, 0.85), x, 0.47, -0.18));
    parts.push(place(box(0.4, 0.12, 0.03, tint), 0, 0.78, -0.18), place(box(0.4, 0.04, 0.03, tint, 0.9), 0, 0.6, -0.18));
  } else {
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      parts.push(place(box(0.04, 0.03, 0.3, frameTint).translate(0, 0.04, 0.15), 0, 0, 0, a));
      parts.push(place(box(0.05, 0.04, 0.05, frameTint, 0.6), Math.sin(a) * 0.28, 0, Math.cos(a) * 0.28));
    }
    parts.push(place(box(0.05, 0.36, 0.05, 'ash'), 0, 0.07, 0), place(box(0.48, 0.08, 0.46, tint), 0, 0.42, 0));
    parts.push(place(box(0.05, 0.22, 0.04, frameTint), 0, 0.46, -0.22), place(box(0.44, 0.5, 0.07, tint, 0.9), 0, 0.62, -0.24));
    for (const x of [-0.25, 0.25]) parts.push(place(box(0.05, 0.03, 0.26, frameTint), x, 0.64, 0), place(box(0.03, 0.14, 0.03, frameTint), x, 0.5, -0.02));
  }
  return merge(parts);
}

/** A desk lamp: `body` its base, arms and shade; `lamp` the bulb under the shade (for a glow material); `head` where it is. */
export interface DeskLamp {
  body: THREE.BufferGeometry;
  lamp: THREE.BufferGeometry;
  head: THREE.Vector3;
}

/** An anglepoise desk lamp about 0.45 m tall, reaching out along +z. */
export function deskLamp({ tint = 'soot' as Tint, shadeTint = 'brick' as Tint } = {}): DeskLamp {
  const base = new THREE.Vector3(0, 0.03, -0.05);
  const elbow = new THREE.Vector3(0, 0.36, -0.12);
  const head = new THREE.Vector3(0, 0.42, 0.18);
  const shade = new THREE.ConeGeometry(0.1, 0.14, 8, 1, true).rotateX(-0.5).translate(head.x, head.y, head.z);
  const body = merge([
    place(paint(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 8), tint), 0, 0.015, -0.05),
    rod(base, elbow, 0.022, tint),
    rod(elbow, head.clone().add(new THREE.Vector3(0, 0.05, -0.03)), 0.022, tint),
    paint(shade, shadeTint),
  ]);
  const lamp = paint(new THREE.CircleGeometry(0.075, 8).rotateX(Math.PI / 2 - 0.5).translate(head.x, head.y - 0.06, head.z + 0.03), 'lastLight');
  lamp.computeVertexNormals();
  return { body, lamp, head };
}

const BOOK_TINTS: Tint[] = ['brick', 'steel', 'wheat', 'krakowRoof', 'chalk', 'terracotta', 'slate', 'dawnGold'];

/**
 * A wall shelf `w` wide: `shelves` boards `gap` apart standing out `depth` from the wall (its back at z = 0, the lowest
 * board at y = 0), between two end panels, with seeded rows of books. `low` stands the books in fewer, wider blocks.
 */
export function shelf(
  w: number,
  { shelves = 2, gap = 0.32, depth = 0.22, seed = 1, tint = 'brass' as Tint, low = false }: { shelves?: number; gap?: number; depth?: number; seed?: number; tint?: Tint; low?: boolean } = {},
): THREE.BufferGeometry {
  const random = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  const top = (shelves - 1) * gap;
  for (const x of [-w / 2, w / 2]) parts.push(place(box(0.025, top + 0.03, depth, tint, 0.85), x, 0, depth / 2));
  for (let s = 0; s < shelves; s++) {
    parts.push(place(box(w + 0.04, 0.025, depth, tint), 0, s * gap, depth / 2));
    if (s === shelves - 1 && shelves > 1) continue;
    let x = -w / 2 + 0.03;
    const end = w / 2 - 0.03 - (0.1 + random() * 0.25);
    while (x < end) {
      const bw = (low ? 0.12 : 0.03) + random() * (low ? 0.08 : 0.035);
      const bh = Math.min(gap - 0.04, 0.17 + random() * 0.1);
      if (x + bw > end) break;
      parts.push(place(box(bw, bh, depth * (0.75 + random() * 0.2), BOOK_TINTS[Math.floor(random() * BOOK_TINTS.length)], 0.75 + random() * 0.3, true), x + bw / 2, s * gap + 0.025, depth / 2));
      x += bw + (random() < 0.12 ? 0.04 : 0.003);
    }
  }
  return merge(parts);
}

export interface FigureOptions {
  /** Jacket colour; by default one of the seed's. */
  coat?: Tint;
  trousers?: Tint;
  /** A hi-vis tabard over the jacket: a marshal. */
  tabard?: Tint;
  /** Fewer parts, for phones: no arms, no hat, one block for the legs. */
  low?: boolean;
}

const COATS: Tint[] = ['steel', 'krakowRoof', 'brick', 'slate', 'wheat', 'beech', 'terracotta', 'ash'];
const SKIN = new THREE.Color('#d7a583');

/** A person about 1.75 m tall, facing +z: no face or features, only the shape of someone standing and watching. */
export function figure(seed: number, { coat, trousers = 'slate', tabard, low = false }: FigureOptions = {}): THREE.BufferGeometry {
  const random = seeded(seed);
  const jacket = vary(coat ?? COATS[Math.floor(random() * COATS.length)], random);
  const k = 0.94 + random() * 0.1;
  const parts: THREE.BufferGeometry[] = [];
  if (low) parts.push(box(0.3, 0.8, 0.15, trousers));
  else for (const x of [-0.08, 0.08]) parts.push(place(box(0.13, 0.8, 0.15, trousers), x, 0, 0));
  parts.push(place(box(0.4, 0.62, 0.24, jacket), 0, 0.78, 0));
  if (tabard) parts.push(place(box(0.42, 0.42, 0.26, tabard), 0, 0.92, 0));
  if (!low) {
    // Arms hang at the sides, or one is raised to the passing car.
    const wave = random() < 0.3;
    parts.push(place(box(0.1, 0.6, 0.12, jacket, 0.9), -0.26, 0.8, 0));
    parts.push(wave ? place(box(0.1, 0.55, 0.12, jacket, 0.9).rotateZ(-0.35), 0.25, 1.32, 0) : place(box(0.1, 0.6, 0.12, jacket, 0.9), 0.26, 0.8, 0));
    if (random() < 0.5) parts.push(place(box(0.2, 0.08, 0.2, vary('soot', random).multiplyScalar(2)), 0, 1.66, 0));
  }
  parts.push(place(lump(0.11, 0.13, 0.11, random, SKIN, 0.05), 0, 1.55, 0));
  return merge(parts).scale(k, k, k);
}

/**
 * A Scots pine about `height` tall: a long bare trunk, grey-brown below and orange up top, and a high, flat, broken
 * crown. `low` for phones.
 */
export function scotsPine(seed: number, { height = 10, low = false, foliage = 'spruce' as Tint } = {}): THREE.BufferGeometry {
  const random = seeded(seed);
  const h = height * (0.85 + random() * 0.3);
  const green = vary(foliage, random);
  const parts = [paint(new THREE.CylinderGeometry(0.13, 0.2, h * 0.62, 5).translate(0, h * 0.31, 0), 'brass', 0.4)];
  if (!low) parts.push(paint(new THREE.CylinderGeometry(0.08, 0.13, h * 0.3, 5).translate(0, h * 0.77, 0), 'terracotta', 0.8));
  const blobs = low ? 2 : 3;
  for (let i = 0; i < blobs; i++) {
    const r = h * (i === 0 ? 0.14 : 0.1) * (0.85 + random() * 0.3);
    const a = random() * Math.PI * 2;
    const off = i === 0 ? 0 : h * 0.09;
    parts.push(place(lump(r * 1.3, r * 0.6, r * 1.3, random, green.clone().multiplyScalar(1 - 0.08 * i)), Math.cos(a) * off, h * (0.86 - 0.1 * i), Math.sin(a) * off));
  }
  return merge(parts);
}
