import * as THREE from 'three';
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
