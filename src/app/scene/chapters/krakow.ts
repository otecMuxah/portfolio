import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { enter, glow, leave, lowPoly, seeded, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';

const FACE_ROAD = 0.4;
const CITY_SCALE = 0.7;

/** A gabled roof: a triangular prism along z with its base at y = 0. */
function gable(width: number, height: number, depth: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(1, 1, depth, 3)
    .rotateX(-Math.PI / 2)
    .scale(width / Math.sqrt(3), height / 1.5, 1)
    .translate(0, height / 3, 0);
}

/** A box standing on y = 0. */
const block = (w: number, h: number, d: number) =>
  new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);

/** A group that rises out of the ground from its base. */
function building(x: number, z: number, ...parts: THREE.Object3D[]): THREE.Group {
  const group = new THREE.Group().add(...parts);
  group.position.set(x, 0, z);
  return group;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, y = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.y = y;
  return m;
}

/**
 * Kraków, 2021: red-brick Gothic around the main square. St Mary's two unequal towers
 * (a tall spire ringed by pinnacles, a lower helmet) and copper-green roofs make it
 * read as a different city from Kharkiv at a glance.
 */
export const krakow: ChapterBuilder = () => {
  const object = new THREE.Group();
  // Turned partway toward the road on the front right, so it reads head-on and from the 3/4 view.
  object.rotation.y = FACE_ROAD;
  const brick = lowPoly('krakowBrick');
  const copper = lowPoly('krakowRoof');
  const stone = lowPoly('sandstone');

  // The market square: a low plinth under the old town, short of the road on the front right.
  const square = mesh(new THREE.BoxGeometry(16, 0.3, 8), lowPoly('chalk'), -0.14);
  square.position.z = -4;
  // The old town is modelled at full size and scaled so both spires sit inside the frame.
  const city = new THREE.Group();
  city.scale.setScalar(CITY_SCALE);
  object.add(square, city);

  // St Mary's: nave between two unequal towers, west front to the camera.
  const naveZ = -12;
  const nave = building(
    0,
    naveZ,
    mesh(block(5.4, 7, 9), brick),
    mesh(gable(6, 3.4, 9.4), copper, 7),
  );
  const north = building(
    -3.6,
    naveZ + 4.2,
    mesh(block(2.6, 11.5, 2.6), brick),
    mesh(new THREE.CylinderGeometry(1.15, 1.35, 1.2, 8).translate(0, 0.6, 0), brick, 11.5),
    mesh(new THREE.ConeGeometry(1.15, 5.2, 8).translate(0, 2.6, 0), copper, 12.7),
    mesh(
      mergeGeometries(
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) =>
            new THREE.ConeGeometry(0.28, 1.5, 5).translate(sx * 1.1, 0.75, sz * 1.1),
          ),
        ),
      ),
      copper,
      11.5,
    ),
  );
  const south = building(
    3.6,
    naveZ + 4.2,
    mesh(block(2.4, 9.4, 2.4), brick),
    mesh(new THREE.ConeGeometry(1.5, 1.5, 8).translate(0, 0.75, 0), copper, 9.4),
    mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.3, 6).translate(0, 0.65, 0), copper, 10.9),
  );

  // Gothic townhouses around the square, gable-fronted, alternating brick and copper roofs.
  const rand = seeded(2021);
  const houses = [
    { x: -11, z: -5, w: 3 },
    { x: -7.8, z: -6.5, w: 2.8 },
    { x: 8, z: -6.5, w: 2.8 },
    { x: 11, z: -5, w: 3.1 },
    { x: 11.6, z: -1, w: 2.6 },
  ].map(({ x, z, w }, i) => {
    const h = 4.2 + rand() * 2.4;
    return building(
      x,
      z,
      mesh(block(w, h, 3), i === 4 ? stone : brick),
      mesh(gable(w, 2 + rand() * 0.8, 3.1), i % 2 ? brick : copper, h),
    );
  });

  // Lit windows: one merged glow mesh, fading in once the city has risen.
  const windowShapes: THREE.BufferGeometry[] = [
    // St Mary's great west window and the tower lancets.
    new THREE.BoxGeometry(1.4, 3.6, 0.1).translate(0, 4.2, naveZ + 4.55),
    new THREE.BoxGeometry(0.45, 2, 0.1).translate(-3.6, 8.2, naveZ + 5.55),
    new THREE.BoxGeometry(0.45, 1.8, 0.1).translate(3.6, 6.8, naveZ + 5.45),
  ];
  houses.forEach((house) => {
    const body = (house.children[0] as THREE.Mesh).geometry as THREE.BoxGeometry;
    const { width, height } = body.parameters;
    for (let row = 1.4; row < height - 0.6; row += 1.5) {
      for (const dx of [-width / 4, width / 4]) {
        if (rand() < 0.3) continue;
        windowShapes.push(
          new THREE.BoxGeometry(0.4, 0.7, 0.1).translate(
            house.position.x + dx,
            row,
            house.position.z + 1.52,
          ),
        );
      }
    }
  });
  const windowGlow = glow('candle', 1.2);
  const windows = mesh(mergeGeometries(windowShapes), windowGlow);
  windowShapes.forEach((g) => g.dispose());

  const risers = [nave, north, south, ...houses];
  city.add(...risers, windows);

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      square.visible = built > 0;
      square.scale.setScalar(Math.max(built, 1e-3));
      risers.forEach((group, i) => {
        const delay = i < 3 ? i * 0.08 : 0.2 + (i - 3) * 0.06;
        const k = smoothstep(delay, delay + 0.5, built);
        group.visible = k > 0;
        group.scale.y = Math.max(k, 1e-3);
      });
      const lit = smoothstep(0.85, 1, built) * (1 - 0.5 * leave(local));
      windows.visible = lit > 0;
      windowGlow.emissiveIntensity = 1.2 * lit * (1 + 0.05 * Math.sin(time * 1.7));
    },
  };
};
