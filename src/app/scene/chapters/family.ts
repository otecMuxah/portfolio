import * as THREE from 'three';
import { enter, glow, halo, leave, lightPool, lowPoly, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';

const LIGHT_Y = 3.4;
const LIGHT_Z = -1;
/** Where each of the two lights starts (±) and where it stops beside the other. */
const FAR_X = 9;
const MET_X = 1.2;
/** Turns the lights' path square to the road camera at (18, 7, 16), so the two never pass behind each other. */
const FACE_ROAD = Math.atan2(18, 16);

interface Candle {
  group: THREE.Group;
  flame: THREE.MeshStandardMaterial;
  aura: THREE.SpriteMaterial;
}

function candle(radius: number, haloSize: number): Candle {
  const group = new THREE.Group();
  const flame = glow('candle', 0);
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), flame));
  const sprite = halo('candle', haloSize, 0);
  group.add(sprite);
  return { group, flame, aura: sprite.material };
}

/** 2006–2010: two candle lights approach and meet (2006 → 2010), then a third, smaller light appears between them (2010). */
export const family: ChapterBuilder = () => {
  const object = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5, 0.4, 10).translate(0, 0.2, -1.5), lowPoly('sandstone'));
  object.add(plinth);

  const stage = new THREE.Group();
  stage.rotation.y = FACE_ROAD;
  object.add(stage);
  const pair = [candle(0.6, 5), candle(0.6, 5)];
  const child = candle(0.42, 3.8);
  child.group.position.set(0, LIGHT_Y - 0.9, LIGHT_Z + 0.4);
  [...pair, child].forEach((c) => stage.add(c.group));

  // No real light: a glow pool on the plinth warms as the lights come together.
  const pool = lightPool('candle', 10, 10);
  pool.position.set(0, 0.41, -1.5);
  object.add(pool);

  return {
    object,
    update({ local, time }) {
      const lit = enter(local);
      const calm = leave(local);
      const met = smoothstep(0, 0.5, local);
      const born = smoothstep(0.5, 0.9, local);
      const idle = 1 - 0.6 * calm;
      const rise = smoothstep(0.1, 0.4, lit);
      plinth.visible = rise > 0;
      plinth.scale.setScalar(Math.max(rise, 1e-3));

      pair.forEach(({ group, flame, aura }, i) => {
        const side = i ? 1 : -1;
        group.position.set(side * (FAR_X - (FAR_X - MET_X) * met), LIGHT_Y + Math.sin(time * 1.1 + i * 2) * 0.12 * idle, LIGHT_Z);
        const flicker = 1 + 0.08 * Math.sin(time * 9 + i * 5) * idle;
        flame.emissiveIntensity = lit * 0.9 * flicker * (1 - 0.3 * calm);
        aura.opacity = lit * flicker * (1 - 0.3 * calm);
      });

      child.group.visible = born > 0;
      child.group.scale.setScalar(Math.max(born, 1e-3));
      child.flame.emissiveIntensity = born * 0.9 * (1 - 0.3 * calm);
      child.aura.opacity = born * (1 - 0.3 * calm);

      pool.material.opacity = lit * (0.25 + 0.5 * met + 0.2 * born) * (1 - 0.3 * calm);
    },
  };
};
