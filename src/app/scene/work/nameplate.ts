import * as THREE from 'three';
import { lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { PALETTE, PaletteKey } from '../art/palette';
import { Cell, WorkAtlas } from './atlas';

/** The lit face: 6 m by 1.5 m, the aspect of an atlas face cell. */
export const FACE_W = 6;
export const FACE_H = 1.5;
/** Vertical triangular slats that turn together, a trivision sign: each shows a third of a face on each side. */
export const SLATS = 10;
const SLAT_W = FACE_W / SLATS;
/** Distance from a slat's axis to an edge. */
const CIRCUM = SLAT_W / Math.sqrt(3);
/** How far each slat lags the one on its left as a turn runs across the face, as a share of the turn. */
const STAGGER = 0.45;
const RAIL = 0.24;
const DEPTH = 2 * CIRCUM + 0.3;
/** The yaw that turns a sign's face (+z) to the camera road at (18, 7, 16) from the anchor. */
export const FACE_ROAD = Math.atan2(18, 16);

/**
 * Where each slat stands among the faces at `at` (0 = first face, 1 = second, ...): the turn sweeps across the face
 * from left to right, each slat starting a little after its neighbour. Pure, so reverse scrolling turns them back.
 */
export function slatTurn(at: number, slat: number): number {
  const whole = Math.floor(at);
  const into = at - whole;
  const delay = (STAGGER * slat) / (SLATS - 1);
  return whole + smoothstep(delay, delay + 1 - STAGGER, into);
}

/**
 * A company's nameplate as a roadside pylon sign: two posts on low-poly plinths carrying a lit cabinet whose face is
 * a trivision of slats, so where a chapter holds several companies the face turns from one to the next as the scroll
 * goes on. The name and the small line under it come from the shared atlas.
 */
export class Nameplate {
  readonly object = new THREE.Group();
  private readonly slats: THREE.Mesh;
  private readonly base: Float32Array;
  private readonly position: THREE.BufferAttribute;
  private readonly face: THREE.MeshStandardMaterial;
  private readonly angles = new Float32Array(SLATS).fill(NaN);

  /** `height`: the face's centre above the ground; `faces`: one atlas cell per company, in date order. */
  constructor(atlas: WorkAtlas, faces: Cell[], height: number, tint: PaletteKey) {
    this.object.rotation.y = FACE_ROAD;
    const bottom = height - FACE_H / 2 - RAIL;
    const posts = [-1, 1].map((side) => side * (FACE_W / 2 - 1));
    const cabinet = mergedMesh(
      [
        new THREE.BoxGeometry(FACE_W + 0.5, RAIL, DEPTH).translate(
          0,
          height + FACE_H / 2 + RAIL / 2,
          0,
        ),
        new THREE.BoxGeometry(FACE_W + 0.5, RAIL, DEPTH).translate(0, bottom + RAIL / 2, 0),
        new THREE.BoxGeometry(0.25, FACE_H, DEPTH).translate(-FACE_W / 2 - 0.125, height, 0),
        new THREE.BoxGeometry(0.25, FACE_H, DEPTH).translate(FACE_W / 2 + 0.125, height, 0),
        new THREE.BoxGeometry(FACE_W, FACE_H, 0.1).translate(0, height, -CIRCUM - 0.08),
        ...posts.map((x) => new THREE.BoxGeometry(0.3, bottom, 0.3).translate(x, bottom / 2, -0.3)),
        // The plinths: square frustums the posts stand in.
        ...posts.map((x) =>
          new THREE.CylinderGeometry(0.5, 0.7, 0.9, 4)
            .rotateY(Math.PI / 4)
            .translate(x, 0.45, -0.3),
        ),
      ],
      lowPoly('ground'),
    );

    // Each slat: three faces around its axis, face k turned -k * 120° so that turning the slat by k * 120° shows it.
    const shows = [0, 1, 2].map((k) => faces[k % faces.length]);
    const base: number[] = [];
    const uv: number[] = [];
    const y0 = height - FACE_H / 2;
    const y1 = height + FACE_H / 2;
    for (let i = 0; i < SLATS; i++) {
      for (let k = 0; k < 3; k++) {
        const phi = (-k * Math.PI * 2) / 3;
        const [lx, lz] = [
          Math.sin(phi - Math.PI / 3) * CIRCUM,
          Math.cos(phi - Math.PI / 3) * CIRCUM,
        ];
        const [rx, rz] = [
          Math.sin(phi + Math.PI / 3) * CIRCUM,
          Math.cos(phi + Math.PI / 3) * CIRCUM,
        ];
        const cell = shows[k];
        const u0 = cell.u0 + ((cell.u1 - cell.u0) * i) / SLATS;
        const u1 = cell.u0 + ((cell.u1 - cell.u0) * (i + 1)) / SLATS;
        const corners: [number, number, number, number, number][] = [
          [lx, y0, lz, u0, cell.v0],
          [rx, y0, rz, u1, cell.v0],
          [rx, y1, rz, u1, cell.v1],
          [lx, y0, lz, u0, cell.v0],
          [rx, y1, rz, u1, cell.v1],
          [lx, y1, lz, u0, cell.v1],
        ];
        for (const [x, y, z, u, v] of corners) {
          base.push(x, y, z);
          uv.push(u, v);
        }
      }
    }
    this.base = Float32Array.from(base);
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(this.base.slice(), 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeBoundingSphere();
    this.face = new THREE.MeshStandardMaterial({
      color: PALETTE[tint],
      map: atlas.texture,
      emissive: PALETTE[tint],
      emissiveMap: atlas.texture,
      emissiveIntensity: 0,
      roughness: 0.6,
      flatShading: true,
      // Opaque as drawn; lets the war fade the face out with the other lights (see Shatter).
      transparent: true,
    });
    // Set back in the cabinet: the slats turn inside the rails, never through them.
    this.slats = new THREE.Mesh(geometry, this.face);

    this.object.add(cabinet, this.slats);
    this.turn(0);
  }

  /**
   * `at`: which face shows (fractional mid-turn); `built`: 0..1 as the chapter builds in; `lit`: the face's glow.
   * Pure in its inputs.
   */
  update(at: number, built: number, lit: number): void {
    this.object.visible = built > 0;
    const footprint = Math.max(smoothstep(0, 0.3, built), 1e-3);
    this.object.scale.set(footprint, Math.max(built, 1e-3), footprint);
    this.face.emissiveIntensity = 0.95 * lit;
    this.turn(at);
  }

  private turn(at: number): void {
    const p = this.position.array as Float32Array;
    let changed = false;
    for (let i = 0; i < SLATS; i++) {
      const angle = (slatTurn(at, i) * Math.PI * 2) / 3;
      if (angle === this.angles[i]) continue;
      this.angles[i] = angle;
      changed = true;
      const cx = -FACE_W / 2 + SLAT_W * (i + 0.5);
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      for (let v = i * 18; v < (i + 1) * 18; v++) {
        const x = this.base[v * 3];
        const z = this.base[v * 3 + 2];
        p[v * 3] = cx + x * c + z * s;
        p[v * 3 + 2] = -x * s + z * c;
      }
    }
    if (changed) this.position.needsUpdate = true;
  }
}
