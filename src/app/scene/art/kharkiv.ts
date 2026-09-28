import * as THREE from 'three';
import { block, lowPoly, mergedMesh, seeded } from './kit';
import { PaletteKey } from './palette';

/** [width, height, depth, x, z, base y]; the skyline sits around its own origin, facing +z (the camera). */
type Block = [number, number, number, number, number, number?];

/** Derzhprom, stylised: a stepped central tower, two stepped wings and the sky-bridges between them. */
const DERZHPROM: Block[] = [
  [5, 6, 4, 0, -3],
  [3.6, 3.5, 3.2, 0, -3, 6],
  [2.4, 3, 2.4, 0, -3, 9.5],
  [0.3, 2, 0.3, 0, -3, 12.5],
  ...([-1, 1].flatMap((s) => [
    [3.5, 5, 4, s * 5.5, -3],
    [2.4, 3, 3, s * 5.5, -3, 5],
    [2.6, 1, 1.6, s * 3.05, -3, 6.2],
    [1.6, 2.5, 3, s * 3.1, -3],
  ]) as Block[]),
];

const PANEL_BLOCKS: Block[] = [
  [3, 7, 3, -9.5, -4],
  [2.6, 8.5, 3, 9.5, -5],
  [3, 4.5, 2.5, -7.5, -7.5],
  [2.5, 3, 2.5, 8.5, -1.5],
  [3, 9, 2.5, 3, -7.5],
];

const BRICK_BLOCKS: Block[] = [
  [2.5, 3.5, 2.5, -10.5, -0.5],
  [2, 5, 3, 11, -2.5],
  [2.5, 7, 2, -3.5, -8],
  [2.5, 5.5, 2.5, 7.5, -8],
];

/** Blocks are laid out on a 1:0.7 plan, so the whole skyline frames inside one chapter's shot. */
const SCALE = 0.7;

const LAYERS: [string, PaletteKey, Block[]][] = [
  ['derzhprom', 'chalk', DERZHPROM],
  ['panel-blocks', 'sandstone', PANEL_BLOCKS],
  ['brick-blocks', 'brick', BRICK_BLOCKS],
];

/** Kharkiv's skyline, about 17 m wide and 10 m tall, built around its origin: three merged flat-shaded meshes, Derzhprom as the hero. */
export function kharkivSkyline(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'kharkiv-skyline';
  for (const [name, key, blocks] of LAYERS) {
    const mesh = mergedMesh(
      blocks.map(([w, h, d, x, z, y = 0]) => block(w * SCALE, h * SCALE, d * SCALE, x * SCALE, z * SCALE, y * SCALE)),
      lowPoly(key),
    );
    mesh.name = name;
    group.add(mesh);
  }
  return group;
}

/** `count` seeded points (xyz, in skyline space) spread evenly over the skyline's camera-facing surfaces: front, sides and roofs. */
export function kharkivSkylinePoints(count: number, seed: number): Float32Array {
  const skyline = kharkivSkyline();
  const triangles: THREE.Triangle[] = [];
  const normal = new THREE.Vector3();
  skyline.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const pos = obj.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const tri = new THREE.Triangle(
        new THREE.Vector3().fromBufferAttribute(pos, i),
        new THREE.Vector3().fromBufferAttribute(pos, i + 1),
        new THREE.Vector3().fromBufferAttribute(pos, i + 2),
      );
      tri.getNormal(normal);
      // Floors and back walls are never seen from the path, so points there would be wasted.
      if (normal.y > -0.5 && normal.z > -0.5) triangles.push(tri);
    }
    obj.geometry.dispose();
  });

  const cumulative: number[] = [];
  let total = 0;
  for (const tri of triangles) cumulative.push((total += tri.getArea()));

  const random = seeded(seed);
  const out = new Float32Array(count * 3);
  const point = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const pick = random() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < pick) lo = mid + 1;
      else hi = mid;
    }
    const tri = triangles[lo];
    let u = random();
    let v = random();
    if (u + v > 1) [u, v] = [1 - u, 1 - v];
    point
      .copy(tri.a)
      .addScaledVector(tri.b.clone().sub(tri.a), u)
      .addScaledVector(tri.c.clone().sub(tri.a), v)
      // Lift off the face so a landed particle isn't half-buried in the wall.
      .addScaledVector(tri.getNormal(normal), 0.05);
    point.toArray(out, i * 3);
  }
  return out;
}
