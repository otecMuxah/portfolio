import * as THREE from 'three';
import { PALETTE, PaletteKey } from '../art/palette';

export const RING_MIN_RADIUS = 3;
export const RING_MAX_RADIUS = 7.5;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** How many skills have joined the ring, as a continuous count: 0 at local 0, all of them at local 1. */
const grown = (local: number, total: number) => clamp01(local) * total;

/** Size of token `i` (0..1): tokens join in order, each growing in over its own slice of the chapter. */
export function tokenScale(i: number, local: number, total: number): number {
  return clamp01(grown(local, total) - i);
}

/** How many tokens are visible at this local progress. */
export function tokensShown(local: number, total: number): number {
  return Math.min(Math.ceil(grown(local, total)), total);
}

/** The orbit widens as skills join, so the ring reads as growing, not just filling. */
export function ringRadius(local: number): number {
  return RING_MIN_RADIUS + (RING_MAX_RADIUS - RING_MIN_RADIUS) * clamp01(local);
}

export interface SkillOrbit {
  object: THREE.InstancedMesh;
  /** Pure in `local`; `time` only turns the ring and bobs the badges. */
  update(local: number, time: number): void;
}

const BADGE_SIZE = 0.9;

/**
 * A ring of low-poly badges, one per skill, each in its own warm tint. Decoration, so it is
 * instanced (one draw call); the skill names themselves live in the HTML card.
 */
export function skillOrbit(tints: PaletteKey[]): SkillOrbit {
  const total = tints.length;
  // A hexagonal badge facing +z.
  const geometry = new THREE.CylinderGeometry(BADGE_SIZE / 2, BADGE_SIZE / 2, 0.18, 6).rotateX(
    Math.PI / 2,
  );
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    flatShading: true,
    roughness: 0.55,
    emissive: PALETTE.homeGlow,
    emissiveIntensity: 0.25,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, total);
  // Instances move every frame, so a bounding sphere computed once would cull the ring wrongly.
  mesh.frustumCulled = false;
  const colour = new THREE.Color();
  tints.forEach((key, i) => mesh.setColorAt(i, colour.set(PALETTE[key])));

  const dummy = new THREE.Object3D();
  const update = (local: number, time: number) => {
    const shown = tokensShown(local, total);
    const spacing = (Math.PI * 2) / Math.max(grown(local, total), 1);
    const radius = ringRadius(local);
    const turn = time * 0.15;
    for (let i = 0; i < shown; i++) {
      const angle = i * spacing + turn;
      dummy.position.set(
        Math.sin(angle) * radius,
        Math.sin(time * 1.3 + i) * 0.15,
        Math.cos(angle) * radius,
      );
      dummy.rotation.set(0.25, angle, 0);
      dummy.scale.setScalar(Math.max(tokenScale(i, local, total), 1e-4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = shown;
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0);
  return { object: mesh, update };
}
