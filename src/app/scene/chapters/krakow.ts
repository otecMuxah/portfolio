import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  arcade,
  arch,
  box,
  detailMesh,
  gable,
  merge,
  onion,
  paint,
  place,
  row,
  shade,
  streetLamp,
  Tint,
  tower,
  windowGrid,
} from '../art/details';
import { block, enter, glow, leave, lowPoly, seeded, smoothstep } from '../art/kit';
import { bakeAO, contactShadows } from '../art/shading';
import { ChapterBuilder } from '../chapter-scene';

const FACE_ROAD = 0.4;
const CITY_SCALE = 0.7;

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

/** Painted detail, its AO baked, as a mesh: the war leaves it out rather than breaking it. */
function dressing(parts: THREE.BufferGeometry[]): THREE.Mesh {
  return detailMesh(bakeAO(merge(parts), { corner: 0 }));
}

/** Tall Gothic lancets on a wall facing +z: dark glass under an arched head, framed in white stone on desktops. */
function lancets(columns: readonly number[], rows: readonly number[], width: number, height: number, phone: boolean): THREE.BufferGeometry {
  return windowGrid({ columns, rows, width, height, arched: true, lit: 0, frame: phone ? 0 : 0.05, mullions: phone ? 0 : 1, transom: false, sill: 0 }).frames;
}

/** White stone string courses round a square tower `w` wide, at each height. */
function courses(w: number, heights: readonly number[]): THREE.BufferGeometry[] {
  return heights.map((y) => place(box(w + 0.1, 0.12, w + 0.1, 'chalk', 0.9), 0, y, 0));
}

/**
 * The Cloth Hall (Sukiennice), in the middle of the square, its long side to the camera: cream stone over a ground-floor
 * arcade, a red-brick upper storey, the Renaissance attic with its scalloped crest and pinnacles, small domed turrets
 * at its corners, and the 1870s risalit at its middle. Built at its origin, `length` along x; lit panes go to `lit`.
 */
function clothHall(length: number, phone: boolean, lit: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const depth = 2.2;
  const height = 2.5;
  const stone: Tint = 'wheat';
  const front = depth / 2;
  const segments = phone ? 3 : 5;
  const parts: THREE.BufferGeometry[] = [
    box(length, height, depth, stone),
    place(box(length + 0.02, 0.8, depth + 0.02, 'krakowBrick', 0.95), 0, 1.45, 0),
    place(box(length + 0.16, 0.08, depth + 0.16, stone, 0.9), 0, height, 0),
    place(box(length - 0.1, 0.4, depth - 0.1, stone, 1.02), 0, height + 0.08, 0),
    // The ground-floor arcade along the front and round the end the camera sees.
    place(arcade(length - 0.4, 9, 0.7, { pier: 0.2, depth: 0.1, tint: stone, segments }), 0, 0, front),
    place(arcade(depth - 0.4, 2, 0.7, { pier: 0.2, depth: 0.1, tint: stone, segments }), length / 2, 0, 0, Math.PI / 2),
    // The risalit: a taller bay standing forward, with its own arch and pediment.
    place(box(1.6, height + 0.7, 0.3, stone, 1.04), 0, 0, front + 0.15),
    place(arcade(1.2, 1, 1, { pier: 0.2, depth: 0.08, tint: stone, segments }), 0, 0, front + 0.3),
    place(paint(gable(1.7, 0.55, 0.32), stone, 1.04), 0, height + 0.7, front + 0.15),
  ];
  // The attic's crest: half-discs between pinnacles along the front (and the back, where it shows against the sky).
  const spacing = (length - 0.6) / 8;
  for (const z of phone ? [front - 0.1] : [front - 0.1, -front + 0.1]) {
    for (const x of row(8, spacing)) parts.push(place(paint(new THREE.CircleGeometry(0.28, phone ? 4 : 6, 0, Math.PI), stone, 1.06), x, height + 0.48, z));
    for (const x of row(9, spacing)) parts.push(place(paint(new THREE.ConeGeometry(0.06, 0.4, 4), 'chalk'), x, height + 0.68, z));
  }
  // The attic's blind arcade, a shade darker in its niches.
  if (!phone) parts.push(place(arcade(length - 0.4, 12, 0.18, { pier: 0.08, depth: 0.03, tint: stone, shadow: shade(stone, 0.7), segments: 3 }), 0, height + 0.12, front - 0.03));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const turret = tower(0.26, 0.9, { sides: phone ? 6 : 8, roof: 'dome', roofHeight: 0.35, tint: stone, roofTint: 'krakowRoof' });
    parts.push(place(turret, (x * (length - 0.3)) / 2, height, (z * (depth - 0.3)) / 2));
  }
  // The upper storey's windows, in the brick, clear of the risalit.
  const windows = windowGrid({
    columns: row(8, 1).filter((x) => Math.abs(x) > 1),
    rows: [1.62],
    width: 0.3,
    height: 0.45,
    frame: phone ? 0 : 0.05,
    mullions: 0,
    transom: false,
    sill: 0,
    frameTint: stone,
    lit: 0.4,
    seed: 1556,
  });
  parts.push(place(windows.frames, 0, 0, front));
  lit.push(place(windows.lit, 0, 0, front));
  return parts;
}

/**
 * Kraków, 2021: red-brick Gothic around the main square. St Mary's two unequal towers
 * (a tall spire ringed by pinnacles, a lower helmet) and copper-green roofs make it
 * read as a different city from Kharkiv at a glance. Its detail (#75) follows the Basilica and the square as they
 * are: the north tower's Gothic spire ringed by eight pinnacles with the gilded crown on its needle, the south
 * tower's Renaissance helmet of lanterns, white stone courses and lancets in the brick, the Cloth Hall, the Rynek's
 * paving and the Mickiewicz monument.
 */
export const krakow: ChapterBuilder = (_chapter, _index, phone = false) => {
  const object = new THREE.Group();
  // Turned partway toward the road on the front right, so it reads head-on and from the 3/4 view.
  object.rotation.y = FACE_ROAD;
  const brick = lowPoly('krakowBrick');
  const copper = lowPoly('krakowRoof');
  const stone = lowPoly('sandstone');

  // The market square: a low plinth under the old town, short of the road on the front right.
  const square = mesh(new THREE.BoxGeometry(16, 0.3, 8), lowPoly('chalk'), -0.14);
  square.position.z = -4;
  // The Rynek's paving: fields of stone set out by darker bands, on the square's top (0.15 over its centre).
  const band = (w: number, d: number, x: number, z: number) => place(paint(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), 'gravel', 1.45), x, 0.152, z);
  square.add(dressing([...row(9, 1.6).map((x) => band(0.07, 7.9, x, 0)), ...row(4, 1.6).map((z) => band(15.9, 0.07, 0, z))]));
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

  // The north tower (the Hejnalica): white courses and lancets up its brick, eight pinnacles round the spire, the
  // gilded crown on its needle (1666) and a gold ball at the tip.
  const northLancets = () => lancets(row(2, 0.9), [3.7, 6.9, 9.7], 0.3, 1.2, phone);
  north.add(
    dressing([
      ...courses(2.6, [3.2, 6.4, 9.2, 11.3]),
      place(northLancets(), 0, 0, 1.3),
      place(northLancets(), 1.3, 0, 0, Math.PI / 2),
      ...[0, 1, 2, 3].map((k) => place(paint(new THREE.ConeGeometry(0.2, 1.2, 5).translate(0, 0.6, 1.25), 'krakowRoof'), 0, 11.5, 0, (k * Math.PI) / 2)),
      paint(new THREE.CylinderGeometry(0.42, 0.34, 0.3, 8).translate(0, 16.5, 0), 'dawnGold'),
      place(onion(0.1, 0.22, { sides: 6 }), 0, 17.85, 0),
      place(box(0.04, 0.8, 0.04, 'dawnGold'), 0, 18, 0),
    ]),
  );

  // The south tower: its courses and lancets, and the late-Renaissance helmet (1592): a domed lantern over the helmet
  // and four small domed turrets at its corners.
  const southLancets = () => lancets(row(2, 0.9), [3.7, 6.7], 0.3, 1.2, phone);
  south.add(
    dressing([
      ...courses(2.4, [3.2, 6.2, 9.2]),
      place(southLancets(), 0, 0, 1.2),
      place(southLancets(), 1.2, 0, 0, Math.PI / 2),
      paint(new THREE.SphereGeometry(0.42, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 12.2, 0), 'krakowRoof', 0.9),
      place(onion(0.13, 0.35, { sides: 6, tint: 'krakowRoof' }), 0, 12.6, 0),
      place(box(0.04, 0.5, 0.04, 'dawnGold'), 0, 12.9, 0),
      ...[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => place(tower(0.2, 0.55, { sides: 6, roof: 'dome', roofHeight: 0.28, tint: 'krakowBrick', roofTint: 'krakowRoof' }), x * 1.02, 9.4, z * 1.02)),
      ),
    ]),
  );

  // The nave: buttresses and tall lancets down the side the camera sees, the stone frame of the great west window,
  // and the little Baroque porch between the towers.
  nave.add(
    dressing([
      ...row(4, 2.2).map((z) => place(box(0.35, 5.6, 0.5, 'krakowBrick', 0.88), 2.87, 0, z)),
      place(lancets(row(3, 2.2), [1.4], 0.55, 3.4, phone), 2.7, 0, 0, Math.PI / 2),
      place(box(0.12, 3.6, 0.12, 'chalk', 0.95), -0.76, 2.4, 4.56),
      place(box(0.12, 3.6, 0.12, 'chalk', 0.95), 0.76, 2.4, 4.56),
      place(arch(1.52, { thickness: 0.12, depth: 0.12, segments: phone ? 3 : 5 }), 0, 5.9, 4.5),
      place(box(1.6, 1.9, 0.9, 'krakowBrick', 1.05), 0, 0, 4.95),
      place(arcade(1.1, 1, 0.9, { pier: 0.18, depth: 0.06, tint: 'chalk' }), 0, 0, 5.4),
      place(paint(new THREE.SphereGeometry(0.62, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), 'krakowRoof'), 0, 1.9, 4.95),
      place(onion(0.12, 0.35, { sides: 6, tint: 'krakowRoof' }), 0, 2.5, 4.95),
    ]),
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

  // The Cloth Hall, in front of St Mary's and to its left, its lit windows glowing with the rest.
  const hallLit: THREE.BufferGeometry[] = [];
  const hallBody = dressing(clothHall(8.6, phone, hallLit));
  const hallWindows = mesh(merge(hallLit), windowGlow);
  const hall = building(-6.6, -1.4, hallBody, hallWindows);

  const risers = [nave, north, south, ...houses, hall];
  city.add(...risers, windows);

  // The Mickiewicz monument (1898) by the Cloth Hall: the poet in patinated bronze on a granite plinth. And the square's
  // lamps, on desktops.
  const squareProps = [
    box(1, 0.3, 1, 'concrete', 1.1),
    place(box(0.7, 0.9, 0.7, 'concrete', 1.2), 0, 0.3, 0),
    place(box(0.8, 0.1, 0.8, 'concrete', 1.1), 0, 1.2, 0),
    paint(new THREE.CylinderGeometry(0.12, 0.2, 0.75, 6).translate(0, 1.68, 0), 'krakowRoof', 0.75),
    paint(new THREE.SphereGeometry(0.1, 6, 4).translate(0, 2.13, 0), 'krakowRoof', 0.75),
  ].map((g) => g.translate(-1.2, 0, -3.3));
  if (!phone) {
    const lamp = streetLamp({ height: 2.4, arm: 0 });
    for (const [x, z] of [[1.9, -1.2], [-11.2, -1.2]]) squareProps.push(place(lamp.body.clone(), x, 0, z), place(lamp.lamp.clone(), x, 0, z));
    lamp.body.dispose();
    lamp.lamp.dispose();
  }
  const props = dressing(squareProps);
  city.add(props);

  // Contact shadows under the old town, laid out in the city's plan and scaled with it.
  const shadows = contactShadows(
    [
      { x: 0, z: -10.5, w: 8, d: 8 },
      { x: -6.6, z: -1.4, w: 9.6, d: 3.2 },
      { x: -1.2, z: -3.3, w: 1.4, d: 1.4 },
      { x: -9.4, z: -5.8, w: 7, d: 4 },
      { x: 9.5, z: -5.8, w: 6, d: 4 },
      { x: 11.6, z: -1, w: 3, d: 3.2 },
    ].map(({ x, z, w, d }) => ({ x: x * CITY_SCALE, z: z * CITY_SCALE, w: w * CITY_SCALE, d: d * CITY_SCALE })),
    { opacity: 0.45, y: 0.02 },
  );
  object.add(shadows);

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      square.visible = built > 0;
      square.scale.setScalar(Math.max(built, 1e-3));
      const settled = smoothstep(0.5, 0.9, built);
      shadows.visible = props.visible = settled > 0;
      shadows.material.opacity = 0.45 * settled;
      props.scale.y = Math.max(settled, 1e-3);
      risers.forEach((group, i) => {
        const delay = i < 3 ? i * 0.08 : 0.2 + (i - 3) * 0.06;
        const k = smoothstep(delay, delay + 0.5, built);
        group.visible = k > 0;
        // Footprint first, as in kharkiv-city.ts: no flat slabs in the previous chapter's frame.
        const footprint = Math.max(smoothstep(0, 0.25, k), 1e-3);
        group.scale.set(footprint, Math.max(k, 1e-3), footprint);
      });
      const lit = smoothstep(0.85, 1, built) * (1 - 0.5 * leave(local));
      windows.visible = hallWindows.visible = lit > 0;
      windowGlow.emissiveIntensity = 1.2 * lit * (1 + 0.05 * Math.sin(time * 1.7));
    },
  };
};
