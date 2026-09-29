import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { asDetail } from './details';
import { haloMap, smoothstep } from './kit';
import { PALETTE, PaletteKey } from './palette';

/**
 * Surfaces (#70): light the world as a diorama without shadow maps or post-processing. Ambient occlusion is baked
 * into vertex colours once, at build; contact shadows are soft blobs on the ground. Both cost nothing per frame.
 */

export interface AOOptions {
  /** Ground level (m). Default 0. */
  floor?: number;
  /** Height over which the darkening at a wall's foot fades out (m). Default 1.5. */
  fade?: number;
  /** How dark a wall goes at its foot, 0..1. Default 0.3. */
  base?: number;
  /** How dark faces turned down go (soffits, the undersides of sills and canopies), 0..1. Default 0.25. */
  under?: number;
  /** Reach of the darkening into an inner corner (m); 0 turns it off. Default 0.4. */
  corner?: number;
  /** How dark an inner corner goes, 0..1. Default 0.35. */
  cornerStrength?: number;
  /** Geometry that shades this one without being shaded itself: the building a sill sits on, the ground a wall stands on. */
  occluders?: THREE.BufferGeometry[];
}

interface Tri {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  normal: THREE.Vector3;
}

function triangles(geometry: THREE.BufferGeometry): Tri[] {
  const pos = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  const out: Tri[] = [];
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i);
  for (let i = 0; i + 2 < count; i += 3) {
    const t = new THREE.Triangle(at(i), at(i + 1), at(i + 2));
    out.push({ a: t.a, b: t.b, c: t.c, normal: t.getNormal(new THREE.Vector3()) });
  }
  return out;
}

/**
 * Bakes ambient occlusion into a painted geometry's vertex colours (non-indexed, with a `color` attribute: details.ts):
 * walls darken toward their foot, faces turned down darken, and vertices in an inner corner (where another face stands
 * in front of them within `corner` m, and they stand in front of it) darken with nearness. Faces turned up (the ground,
 * a roof) keep their foot light. Deterministic; returns the geometry.
 */
export function bakeAO(geometry: THREE.BufferGeometry, options: AOOptions = {}): THREE.BufferGeometry {
  const { floor = 0, fade = 1.5, base = 0.3, under = 0.25, corner = 0.4, cornerStrength = 0.35, occluders = [] } = options;
  const colour = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!colour) throw new Error('bakeAO needs a painted geometry (a colour attribute)');
  if (geometry.index) throw new Error('bakeAO needs a non-indexed geometry');
  const own = triangles(geometry);
  const all = [...own, ...occluders.flatMap(triangles)];

  // Spatial hash of the triangles, by the cells their bounds (grown by the reach) cover.
  const cells = new Map<string, number[]>();
  const size = Math.max(corner, 0.1);
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  if (corner > 0) {
    const bounds = new THREE.Box3();
    all.forEach((t, i) => {
      bounds.setFromPoints([t.a, t.b, t.c]).expandByScalar(corner);
      const [x0, y0, z0] = bounds.min.toArray().map((v) => Math.floor(v / size));
      const [x1, y1, z1] = bounds.max.toArray().map((v) => Math.floor(v / size));
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const k = key(x, y, z);
            const list = cells.get(k);
            if (list) list.push(i);
            else cells.set(k, [i]);
          }
    });
  }

  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const triangle = new THREE.Triangle();
  /** Whether any corner of `t` stands in front of the plane through `at` facing `n`. */
  const infront = (t: Tri, at: THREE.Vector3, n: THREE.Vector3) =>
    [t.a, t.b, t.c].some((v) => q.subVectors(v, at).dot(n) > 1e-3);

  for (let v = 0; v < own.length * 3; v++) {
    const tri = own[Math.floor(v / 3)];
    const n = tri.normal;
    p.fromBufferAttribute(geometry.getAttribute('position'), v);
    let dark = 0;
    if (n.y < 0.7) dark += base * (1 - smoothstep(floor, floor + fade, p.y));
    if (n.y < -0.5) dark += under;
    if (corner > 0) {
      let occlusion = 0;
      for (const i of cells.get(key(Math.floor(p.x / size), Math.floor(p.y / size), Math.floor(p.z / size))) ?? []) {
        const other = all[i];
        if (other === tri) continue;
        const facing = Math.abs(other.normal.dot(n));
        if (facing > 0.7) continue;
        triangle.set(other.a, other.b, other.c).closestPointToPoint(p, q);
        const d = q.distanceTo(p);
        if (d > corner) continue;
        // Concave only: the other face rises in front of this one, and this one in front of it.
        if (!infront(other, p, n) || !infront(tri, q.clone(), other.normal)) continue;
        occlusion = Math.max(occlusion, (1 - d / corner) ** 2 * (1 - facing));
      }
      dark += cornerStrength * occlusion;
    }
    const k = 1 - Math.min(dark, 0.85);
    colour.setXYZ(v, colour.getX(v) * k, colour.getY(v) * k, colour.getZ(v) * k);
  }
  colour.needsUpdate = true;
  return geometry;
}

export interface ContactShadowOptions {
  /** How dark at its middle, 0..1. Default 0.55. */
  opacity?: number;
  tint?: PaletteKey;
  /** Height above the ground (m), clear of z-fighting. Default 0.015. */
  y?: number;
}

/** A spot on the ground: centre (x, z) and size w × d (m). */
export interface ShadowSpot {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Soft blobs on the ground, one per spot, in one mesh: the halo texture darkening what is under it. Detail: not shattered. */
export function contactShadows(spots: readonly ShadowSpot[], { opacity = 0.55, tint = 'night', y = 0.015 }: ContactShadowOptions = {}): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const planes = spots.map(({ x, z, w, d }) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z));
  const geometry = mergeGeometries(planes);
  planes.forEach((p) => p.dispose());
  const material = new THREE.MeshBasicMaterial({ color: PALETTE[tint], map: haloMap(), transparent: true, opacity, depthWrite: false });
  const mesh = asDetail(new THREE.Mesh(geometry, material));
  mesh.name = 'contact-shadow';
  // Drawn after the ground it lies on.
  mesh.renderOrder = 1;
  return mesh;
}

/** A soft blob w × d on the ground under its origin: contactShadows() with a single spot. */
export function contactShadow(w: number, d: number, options: ContactShadowOptions = {}): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  return contactShadows([{ x: 0, z: 0, w, d }], options);
}
