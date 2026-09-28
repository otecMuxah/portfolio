import * as THREE from 'three';
import { PALETTE, PaletteKey } from './palette';

/** One block of a rebuilt structure: a unit shape (1 × 1 × 1, standing on y = 0) scaled to `size` and set at `at`. */
export interface Piece {
  shape: THREE.BufferGeometry;
  material: THREE.Material;
  colour: PaletteKey;
  /** Centre of its base. */
  at: [x: number, y: number, z: number];
  size: [w: number, h: number, d: number];
  /** Yaw, radians. */
  turn?: number;
  /** Metres above its place it is lowered from; 0 grows it up out of its base instead. */
  drop?: number;
}

/**
 * A unit shape for pieces: `geometry` scaled into 1 × 1 × 1, standing on y = 0. Pieces scale it per instance, so every
 * piece of one shape and material is one draw call.
 */
export function unit(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  return geometry
    .translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2)
    .scale(1 / (max.x - min.x), 1 / (max.y - min.y), 1 / (max.z - min.z));
}

/** A material for pieces: white, so each instance carries its own palette colour. */
export function pieceMaterial(options: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85, metalness: 0, ...options });
}

/**
 * The rebuild's way of making things (#10): a structure put together block by block, in the order its pieces are given.
 * Each piece sets over its own stretch of the assembly `k` (0..1): lowered into place, or grown up from its base. One
 * InstancedMesh per shape and material, posed in place; a piece not yet begun has zero scale at its place.
 */
export class Assembly {
  readonly object = new THREE.Group();
  private readonly placed: { mesh: THREE.InstancedMesh; index: number; piece: Piece }[] = [];
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  /**
   * `span`: share of the assembly each piece takes; 1 / pieces sets them strictly one after another. `lead`: share of
   * its span a piece waits before it shows (time for a crane to swing to it).
   */
  constructor(
    readonly pieces: Piece[],
    readonly span = 1 / pieces.length,
    readonly lead = 0,
  ) {
    const groups = new Map<string, Piece[]>();
    for (const piece of pieces) {
      const key = `${piece.shape.uuid}|${piece.material.uuid}`;
      groups.set(key, [...(groups.get(key) ?? []), piece]);
    }
    const colour = new THREE.Color();
    for (const group of groups.values()) {
      const mesh = new THREE.InstancedMesh(group[0].shape, group[0].material, group.length);
      // Pieces move far from where the bounds were first computed.
      mesh.frustumCulled = false;
      group.forEach((piece, index) => {
        mesh.setColorAt(index, colour.set(PALETTE[piece.colour]));
        this.placed.push({ mesh, index, piece });
      });
      this.meshes.push(mesh);
      this.object.add(mesh);
    }
    this.placed.sort((a, b) => pieces.indexOf(a.piece) - pieces.indexOf(b.piece));
  }

  /** When piece `i` starts to set, as a share of the assembly. */
  start(i: number): number {
    const n = this.pieces.length;
    return n > 1 ? (i / (n - 1)) * (1 - this.span) : 0;
  }

  /** How far piece `i` has set at assembly `k`: 0 not begun, 1 in place. Eased to land softly. */
  progress(k: number, i: number): number {
    const f = Math.min(Math.max((k - this.start(i)) / this.span - this.lead, 0) / (1 - this.lead), 1);
    return 1 - (1 - f) ** 3;
  }

  /** Where piece `i`'s base centre is at assembly `k`. */
  baseAt(k: number, i: number, out: THREE.Vector3): THREE.Vector3 {
    const { at, drop = 0 } = this.pieces[i];
    return out.set(at[0], at[1] + drop * (1 - this.progress(k, i)), at[2]);
  }

  /** Poses every piece for assembly `k`. Pure of `k` and allocation-free, so scrolling back takes it apart exactly. */
  update(k: number): void {
    this.placed.forEach(({ mesh, index, piece }, i) => {
      const e = this.progress(k, i);
      const [w, h, d] = piece.size;
      const grow = piece.drop ? 1 : e;
      this.baseAt(k, i, this.position);
      this.rotation.setFromAxisAngle(this.up, piece.turn ?? 0);
      this.scale.set(w, h * grow, d).multiplyScalar(e > 0 ? 1 : 0);
      mesh.setMatrixAt(index, this.matrix.compose(this.position, this.rotation, this.scale));
    });
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = k > 0;
    }
  }
}
