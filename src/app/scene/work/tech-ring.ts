import * as THREE from 'three';
import { Domain } from '../../content/life';
import { smoothstep } from '../art/kit';
import { PALETTE, PaletteKey } from '../art/palette';
import { WorkAtlas } from './atlas';
import { emblemGeometry } from './emblems';

/** A badge's height, depth and the chamfer of its hexagonal ends (m). */
export const BADGE_H = 0.7;
const BADGE_D = 0.12;
const CHAMFER = (BADGE_H / 2) * Math.tan(Math.PI / 6);
/** Space between neighbouring badges along the ring (m). */
const GAP = 0.35;
export const RING_MIN_RADIUS = 2;
export const RING_MAX_RADIUS = 4.2;
/** The ring leans back from the camera this far (rad), so it reads as a ring in space rather than a flat circle. */
const LEAN = 0.4;
/** Faces the camera road ((18, 7, 16) from the anchor): the ring's plane, and every badge and emblem in it. */
export const FACING = new THREE.Euler(
  -Math.atan2(7, Math.hypot(18, 16)),
  Math.atan2(18, 16),
  0,
  'YXZ',
);

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** Size of badge `i` of `count` (0..1) when its step shows by `weight`: they join in order and leave in reverse. */
export function badgeScale(i: number, count: number, weight: number): number {
  return clamp01(clamp01(weight) * count - i);
}

/** The radius that fits badges of these widths around the ring without any two touching. */
export function ringRadius(widths: number[]): number {
  const around = widths.reduce((sum, w) => sum + w + GAP, 0);
  return Math.min(Math.max(around / (Math.PI * 2), RING_MIN_RADIUS), RING_MAX_RADIUS);
}

export interface RingStep {
  tech: string[];
  domain?: Domain;
}

/** A run of the ring's vertices that moves as one: a badge, the ring itself, or an emblem. */
interface Part {
  first: number;
  end: number;
}

/**
 * The skill ring of the Kharkiv career years, extended to every career step: a thin brass ring facing the road with
 * the step's stack riding it as hexagon-ended badges, each carrying its name, and the step's domain emblem at its
 * hub. Steps take turns: one step's badges leave in reverse order as the next one's join. The ring, every badge and
 * every emblem of every step are one geometry rewritten in place each frame: one draw call, whatever the step count.
 */
export class TechRing {
  readonly object: THREE.Mesh;
  private readonly position: THREE.BufferAttribute;
  /** Every part's vertices around its own origin; badges already turned to face the road. */
  private readonly shape: Float32Array;
  private readonly hoop: Part;
  private readonly badges: (Part & {
    step: number;
    index: number;
    count: number;
    width: number;
  })[] = [];
  private readonly emblems: (Part & { step: number })[] = [];
  private readonly radii: number[];
  private readonly material: THREE.MeshStandardMaterial;
  private readonly matrix = new THREE.Matrix4();
  private readonly lean = new THREE.Quaternion();
  private readonly facing = new THREE.Quaternion().setFromEuler(FACING);
  private readonly turn = new THREE.Quaternion();
  private readonly centre = new THREE.Vector3();
  private readonly size = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  /** A little toward the camera, so the ring never runs across a badge's lettering. */
  private readonly forward = new THREE.Vector3(0, 0, 0.12).applyEuler(FACING);

  constructor(atlas: WorkAtlas, steps: RingStep[], tints: PaletteKey[], glowKey: PaletteKey) {
    this.lean
      .setFromEuler(FACING)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -LEAN));
    const positions: number[] = [];
    const uvs: number[] = [];
    const colours: number[] = [];
    const colour = new THREE.Color();
    const v = new THREE.Vector3();
    const blank = [atlas.blank.u0, atlas.blank.v0];
    /** Appends plain (untextured) triangles in one colour, or in their own vertex colours. */
    const add = (geometry: THREE.BufferGeometry, key?: PaletteKey): Part => {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      const pos = flat.getAttribute('position');
      const col = flat.getAttribute('color');
      const first = positions.length / 3;
      if (key) colour.set(PALETTE[key]);
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        uvs.push(blank[0], blank[1]);
        if (!key) colour.fromBufferAttribute(col as THREE.BufferAttribute, i);
        colours.push(colour.r, colour.g, colour.b);
      }
      geometry.dispose();
      flat.dispose();
      return { first, end: positions.length / 3 };
    };

    this.hoop = add(new THREE.TorusGeometry(1, 0.04, 3, 24), 'brass');
    let tint = 0;
    this.radii = steps.map((step, s) => {
      const widths = step.tech.map((label) => BADGE_H * atlas.label(label).aspect);
      step.tech.forEach((label, index) => {
        const first = positions.length / 3;
        colour.set(PALETTE[tints[tint++ % tints.length]]);
        for (const [x, y, z, u, w] of badge(widths[index], atlas.label(label), atlas.blank)) {
          v.set(x, y, z).applyQuaternion(this.facing);
          positions.push(v.x, v.y, v.z);
          uvs.push(u, w);
          colours.push(colour.r, colour.g, colour.b);
        }
        this.badges.push({
          first,
          end: positions.length / 3,
          step: s,
          index,
          count: step.tech.length,
          width: widths[index],
        });
      });
      if (step.domain) this.emblems.push({ ...add(emblemGeometry(step.domain)), step: s });
      return ringRadius(widths);
    });
    this.shape = Float32Array.from(positions);
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(positions.length), 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    this.material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      map: atlas.texture,
      emissive: PALETTE[glowKey],
      emissiveMap: atlas.texture,
      emissiveIntensity: 0.35,
      roughness: 0.6,
      flatShading: true,
      // Opaque as drawn; lets the war fade the ring out with the other lights (see Shatter).
      transparent: true,
    });
    this.object = new THREE.Mesh(geometry, this.material);
    // Parts move every frame; bounds computed once would cull them wrongly.
    this.object.frustumCulled = false;
    this.update(
      steps.map((_, s) => (s === 0 ? 1 : 0)),
      0,
      1,
    );
  }

  /** How many badges ride the ring, over all steps. */
  get badgeCount(): number {
    return this.badges.length;
  }

  /**
   * `weights`: how far each step shows (0..1), from scroll alone; `time` only turns the ring, bobs the badges and
   * sways the emblem; `lit`: the glow.
   */
  update(weights: number[], time: number, lit: number): void {
    // The radius follows whichever step shows most.
    let total = 0;
    let radius = 0;
    let shown = 0;
    for (let s = 0; s < weights.length; s++) {
      total += weights[s];
      radius += weights[s] * this.radii[s];
      shown = Math.max(shown, weights[s]);
    }
    radius = total > 0 ? radius / total : this.radii[0];
    this.object.visible = shown > 0;
    const hoop = Math.max(radius * smoothstep(0, 0.4, shown), 1e-3);
    this.place(this.hoop, this.centre.set(0, 0, 0), this.lean, this.size.set(hoop, hoop, hoop));

    // Badges ride the ring clockwise from the top, each in a slot as wide as it is, so no two ever overlap.
    const spin = time * 0.05;
    let along = 0;
    let step = -1;
    for (const badge of this.badges) {
      if (badge.step !== step) {
        step = badge.step;
        along = 0;
      }
      const scale = Math.max(badgeScale(badge.index, badge.count, weights[badge.step]), 1e-3);
      const slot = badge.width + GAP;
      const angle = Math.PI / 2 - (along + slot / 2) / this.radii[badge.step] - spin;
      along += slot;
      this.centre
        .set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
        .applyQuaternion(this.lean);
      this.centre.add(this.forward).y += Math.sin(time * 1.3 + badge.first) * 0.05;
      this.place(badge, this.centre, this.turn.identity(), this.size.setScalar(scale));
    }

    // The hub: the showing step's emblem swings in as it grows; `time` only sways it.
    for (const emblem of this.emblems) {
      const k = Math.max(smoothstep(0.2, 1, weights[emblem.step]), 1e-3);
      this.turn
        .setFromAxisAngle(this.v.set(0, 1, 0), (1 - k) * Math.PI + Math.sin(time * 0.6) * 0.3)
        .premultiply(this.facing);
      this.place(emblem, this.centre.set(0, 0, 0), this.turn, this.size.setScalar(k));
    }
    this.position.needsUpdate = true;
    this.material.emissiveIntensity = 0.35 * lit;
  }

  /** Writes a part's vertices, scaled, turned and moved. */
  private place(part: Part, at: THREE.Vector3, turn: THREE.Quaternion, scale: THREE.Vector3): void {
    this.matrix.compose(at, turn, scale);
    const p = this.position.array as Float32Array;
    for (let i = part.first; i < part.end; i++) {
      this.v
        .fromArray(this.shape, i * 3)
        .applyMatrix4(this.matrix)
        .toArray(p, i * 3);
    }
  }
}

/** A hexagon-ended badge `width` m wide, centred and facing +z: the label on its front, the blank on the rest. */
function badge(
  width: number,
  label: { u0: number; v0: number; u1: number; v1: number },
  blank: { u0: number; v0: number },
) {
  const w = width / 2;
  const h = BADGE_H / 2;
  const d = BADGE_D / 2;
  const outline: [number, number][] = [
    [w, 0],
    [w - CHAMFER, h],
    [-w + CHAMFER, h],
    [-w, 0],
    [-w + CHAMFER, -h],
    [w - CHAMFER, -h],
  ];
  const uv = (x: number, y: number): [number, number] => [
    label.u0 + ((x + w) / width) * (label.u1 - label.u0),
    label.v0 + ((y + h) / BADGE_H) * (label.v1 - label.v0),
  ];
  const out: [number, number, number, number, number][] = [];
  for (let i = 1; i < 5; i++) {
    for (const [x, y] of [outline[0], outline[i], outline[i + 1]]) out.push([x, y, d, ...uv(x, y)]);
    for (const [x, y] of [outline[0], outline[i + 1], outline[i]])
      out.push([x, y, -d, blank.u0, blank.v0]);
  }
  for (let i = 0; i < 6; i++) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % 6];
    for (const [x, y, z] of [
      [ax, ay, d],
      [ax, ay, -d],
      [bx, by, -d],
      [ax, ay, d],
      [bx, by, -d],
      [bx, by, d],
    ])
      out.push([x, y, z, blank.u0, blank.v0]);
  }
  return out;
}
