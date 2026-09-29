import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, PaletteKey } from './palette';

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * How far a chapter has built in, from its local progress: 0 while the camera is
 * still a chapter away, 1 once it is framed. Pure, so scrolling back reverses it.
 */
export function enter(local: number): number {
  return smoothstep(-0.6, 0.3, local);
}

/** How far a chapter has settled after the camera leaves it. Build scenes stay; they only calm down. */
export function leave(local: number): number {
  return smoothstep(0.7, 1.6, local);
}

const materials = new Map<string, THREE.MeshStandardMaterial>();

/** The shared flat-shaded material for a palette colour; one per colour keeps draw calls batchable. */
export function lowPoly(key: PaletteKey): THREE.MeshStandardMaterial {
  let material = materials.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: PALETTE[key], flatShading: true, roughness: 0.85, metalness: 0 });
    materials.set(key, material);
  }
  return material;
}

/** A self-lit material for practicals (screens, windows, candles). Per call, since intensity is animated. */
export function glow(key: PaletteKey, intensity = 1.5): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: PALETTE[key],
    emissive: PALETTE[key],
    emissiveIntensity: intensity,
    flatShading: true,
  });
}

/** Seeded random in [0, 1), so particle layouts and screenshots are the same on every load. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let haloTexture: THREE.CanvasTexture | undefined;

/** A soft white radial falloff, drawn once and shared by every halo. */
function haloMap(): THREE.CanvasTexture {
  if (!haloTexture) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    haloTexture = new THREE.CanvasTexture(canvas);
  }
  return haloTexture;
}

/**
 * Light spilling from a practical without a real light: an additive billboard.
 * Per call, since opacity is animated; the gradient texture is shared.
 */
export function halo(key: PaletteKey, size: number, opacity = 0.6): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloMap(),
      color: PALETTE[key],
      opacity,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

/** The shared soft round texture itself, for particles that need a round glow (PointsMaterial.map). */
export { haloMap };

/** A box of size w×h×d whose base sits at (x, y, z): the building block of every low-poly structure. */
export function block(w: number, h: number, d: number, x = 0, z = 0, y = 0): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

/** Merges positioned parts into one plain Mesh of one material: one draw call, still shatterable (not instanced). */
export function mergedMesh(parts: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const geometry = mergeGeometries(flat);
  new Set([...parts, ...flat]).forEach((g) => g.dispose());
  return new THREE.Mesh(geometry, material);
}

/** Light spilling onto a floor or desk, faked without a light: a flat additive glow of width × depth lying at its origin. */
export function lightPool(key: PaletteKey, width: number, depth: number): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const material = new THREE.MeshBasicMaterial({
    color: PALETTE[key],
    map: haloMap(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), material);
  pool.renderOrder = 1;
  return pool;
}
