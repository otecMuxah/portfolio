import * as THREE from 'three';
import { block, enter, glow, leave, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';

const FLOOR = 1.5;
const FLOORS = 4;
/** The main block spans x -8..5, its front face at z = -1. */
const FRONT = -1;

/** School No. 126: a modest four-storey brick Soviet school with rows of warm windows, rising from its yard. */
export const school: ChapterBuilder = () => {
  const object = new THREE.Group();

  const yard = new THREE.Group();
  yard.add(
    mergedMesh([block(20, 0.12, 9, 0, -1.5)], lowPoly('concrete')),
    mergedMesh(
      [
        // Flagpole at the yard's corner, its flag clear of the facade.
        block(0.12, 5, 0.12, -8.9, 1.8),
        // Horizontal bar: two posts and the bar.
        block(0.12, 2.2, 0.12, 6, 1.8),
        block(0.12, 2.2, 0.12, 8, 1.8),
        block(2.1, 0.1, 0.1, 7, 1.8, 2.1),
      ],
      lowPoly('chalk'),
    ),
    mergedMesh([block(1.2, 0.7, 0.05, -9.56, 1.8, 4.2)], lowPoly('dawnGold')),
  );
  object.add(yard);

  const building = new THREE.Group();
  const height = FLOOR * FLOORS;
  building.add(
    mergedMesh(
      [
        block(13, height, 4, -1.5, -3),
        // Stairwell bay, standing proud of the facade and a little taller.
        block(3, height + 0.6, 1, -1.5, -0.5),
        // The gym: a lower wing to the right.
        block(4.5, 3.6, 5.5, 7.25, -3.25),
      ],
      lowPoly('brick'),
    ),
    mergedMesh(
      [
        block(13.3, 0.3, 4.3, -1.5, -3, height),
        block(3.3, 0.3, 1.3, -1.5, -0.5, height + 0.6),
        block(4.8, 0.3, 5.8, 7.25, -3.25, 3.6),
        // Entrance canopy and its posts.
        block(3.8, 0.2, 1.8, -1.5, 0.9, 2.2),
        block(0.2, 2.2, 0.2, -3.2, 1.6),
        block(0.2, 2.2, 0.2, 0.2, 1.6),
      ],
      lowPoly('chalk'),
    ),
  );

  const windows: THREE.BufferGeometry[] = [];
  for (let floor = 0; floor < FLOORS; floor++) {
    for (const x of [-7.2, -6, -4.8, 1.8, 3, 4.2]) windows.push(block(0.75, 0.85, 0.08, x, FRONT, floor * FLOOR + 0.4));
    // The stairwell's tall landing windows.
    if (floor > 0) windows.push(block(1.2, 1.1, 0.08, -1.5, 0, floor * FLOOR + 0.25));
  }
  for (const x of [5.9, 7.25, 8.6]) windows.push(block(1, 1.8, 0.08, x, -0.5, 1.2));
  const windowGlow = glow('dawnGold', 0);
  building.add(mergedMesh(windows, windowGlow));
  object.add(building);

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      yard.visible = built > 0.1;
      const rise = smoothstep(0.1, 0.75, built);
      building.visible = rise > 0;
      building.scale.y = Math.max(rise, 1e-3);
      const lit = smoothstep(0.6, 1, built);
      windowGlow.emissiveIntensity = lit * (1 - 0.4 * calm) * (1 + 0.03 * Math.sin(time * 1.3));
    },
  };
};
