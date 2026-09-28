import * as THREE from 'three';
import { glow, halo, lightPool, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';
import { f30Assembled } from '../rebuild';

/** Where the light hangs, in the chapter's own space: toward the camera, which watches from back-home. */
export const LIGHT = new THREE.Vector3(-6, 2.6, 7);

/**
 * 24.02.2022, 4 a.m., Kharkiv: one light. The engine breaks everything built so far around it (scene/shatter.ts) and
 * drains the world to grey and black (scene/grade.ts); this light alone keeps its colour, and is all that is left
 * when the camera stops. No chapter lights: a glowing core, two halos and a pool on the ground. In the rebuild it
 * gives itself to the F30, which assembles out of it (car-rig.ts), and goes out as the car's headlights come on.
 */
export const war: ChapterBuilder = () => {
  const object = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), glow('lastLight', 2.4));
  core.position.copy(LIGHT);
  const inner = halo('lastLight', 3, 0);
  inner.position.copy(LIGHT);
  const outer = halo('lastLight', 12, 0);
  outer.position.copy(LIGHT);
  const pool = lightPool('lastLight', 3.6, 3.6);
  pool.position.set(LIGHT.x, 0.02, LIGHT.z);
  object.add(pool, outer, inner, core);
  // It must read from across the dark and keep its warmth through the drain: no fog, no grade.
  const materials = [core.material, inner.material, outer.material, pool.material];
  for (const m of materials) {
    m.fog = false;
    m.userData['ungraded'] = true;
  }

  return {
    object,
    update({ progress, local, time }) {
      // It shows as the city breaks in front of it, then holds and grows a little as everything else goes out.
      const lit = smoothstep(0.1, 0.45, local) * (1 - smoothstep(0.55, 1, f30Assembled(progress)));
      const alone = smoothstep(0.35, 0.8, local);
      // Idle only: a slow breath, never what is built.
      const breath = 1 + 0.06 * Math.sin(time * 1.1);
      core.visible = inner.visible = outer.visible = pool.visible = lit > 0;
      core.scale.setScalar(Math.max(lit, 0.001));
      inner.material.opacity = (0.6 + 0.3 * alone) * lit * breath;
      outer.material.opacity = (0.08 + 0.14 * alone) * lit * breath;
      pool.material.opacity = (0.15 + 0.25 * alone) * lit;
    },
  };
};
