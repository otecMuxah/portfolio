import * as THREE from 'three';
import { box, bush, chimney, detailMesh, gable, gabledRoof, merge, paint, place, shade, windowGrid } from '../art/details';
import { enter, glow, halo, leave, lightPool, lowPoly, smoothstep } from '../art/kit';
import { bakeAO, contactShadows } from '../art/shading';
import { ChapterBuilder } from '../chapter-scene';

const LIGHT_Y = 3.4;
const LIGHT_Z = -1;
/** Where each of the two lights starts (±) and where it stops beside the other. */
const FAR_X = 9;
const MET_X = 1.2;
/** Turns the lights' path square to the road camera at (18, 7, 16), so the two never pass behind each other. */
const FACE_ROAD = Math.atan2(18, 16);
/**
 * A house's gable end behind the lights, square to the camera like them (stage frame): its face at WALL_Z, WALL_W wide,
 * EAVES to the eaves and a gable above. Any house: nothing on it says whose.
 */
const WALL_Z = -6.4;
const WALL_W = 9;
const EAVES = 6;
const GABLE = 3;

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

/**
 * 2006–2010: two candle lights approach and meet (2006 → 2010), then a third, smaller light appears between them (2010).
 * Behind them a house wall, its window lighting up as they meet (#74).
 */
export const family: ChapterBuilder = (_chapter, _index, phone = false) => {
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

  // The house: a rendered gable wall on a plinth under its roof's overhang, a chimney, a lit window over the lights
  // and a dark one below to the side; a strip of grass and two bushes at its foot.
  const t = 0.4;
  const render = shade('wheat', 0.72);
  const wall = [
    place(box(WALL_W, EAVES, t, render, 1, true), 0, 0, WALL_Z - t / 2),
    place(paint(gable(WALL_W, GABLE, t), render), 0, EAVES, WALL_Z - t / 2),
    place(box(WALL_W + 0.1, 0.6, t + 0.1, 'concrete', 1, true), 0, 0, WALL_Z - t / 2),
    place(gabledRoof(WALL_W, GABLE + 0.25, 2, { tint: shade('krakowBrick', 0.6), overhang: 0.35 }), 0, EAVES - 0.1, WALL_Z - t - 1),
    place(chimney(0.7, 2.4, 0.7, { tint: shade('brick', 0.8) }), 2, EAVES + 1.2, WALL_Z - 1.4),
    place(paint(new THREE.PlaneGeometry(WALL_W + 1, 3.2).rotateX(-Math.PI / 2), shade('meadow', 0.8)), 0, 0.01, WALL_Z + 1.2),
  ];
  if (!phone) wall.push(place(bush(2006, 1.4), -3.3, 0, WALL_Z + 0.9), place(bush(2010, 1.1), 3.4, 0, WALL_Z + 0.8));
  const light = phone ? { frame: 0, mullions: 0, transom: false } : {};
  const upper = windowGrid({ columns: [0], rows: [4.3], width: 1.8, height: 2.1, lit: 1, frameTint: 'chalk', litTint: 'homeGlow', ...light });
  const lower = windowGrid({ columns: [-2.7], rows: [1.3], width: 1.5, height: 1.8, lit: 0, glassTint: 'night', ...light });
  // Curtains, drawn back either side of the lit window.
  const curtains = [-1, 1].map((side) => place(box(0.35, 2.3, 0.06, 'terracotta', 0.85), side * 0.8, 4.2, 0.05));
  const house = new THREE.Group();
  const structure = bakeAO(merge(wall), { corner: phone ? 0 : 0.5 });
  const frames = bakeAO(merge([upper.frames, lower.frames, ...curtains]), { corner: 0 });
  const windowGlow = glow('homeGlow', 0);
  const pane = detailMesh(upper.lit, windowGlow);
  pane.position.z = WALL_Z;
  const facade = detailMesh(frames);
  facade.position.z = WALL_Z;
  const shadow = contactShadows([{ x: 0, z: WALL_Z + 0.2, w: WALL_W + 2, d: 2.4 }], { opacity: 0.5 });
  house.add(detailMesh(structure), facade, pane, shadow);
  stage.add(house);

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
      const built = smoothstep(0, 0.35, lit);
      house.visible = built > 0;
      house.scale.y = Math.max(built, 1e-3);
      // Home: the window lights as the two meet, and stays lit.
      windowGlow.emissiveIntensity = lit * (0.25 + 0.9 * met) * (1 - 0.3 * calm) * (1 + 0.03 * Math.sin(time * 1.7));

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
