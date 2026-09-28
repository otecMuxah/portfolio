import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CARS, CarId } from '../../content/life';
import { enter, glow, lowPoly, seeded, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';
import { buildCar } from '../cars';

/** One car's bay, shared between the garage scene and the HTML controls laid over it. */
export interface GarageBay {
  id: CarId;
  /** The spin the visitor asked for, in radians; the scene eases the car toward it. User state, not scroll state. */
  spin: number;
  /** Screen position of the car's centre, its roof and its label, in normalised device coordinates. */
  x: number;
  y: number;
  roofY: number;
  labelX: number;
  labelY: number;
  /** Screen height of one metre at the car, in normalised device units. */
  metre: number;
  /** 0 until the car has parked, 1 once it has; 0 whenever it is behind the camera. */
  shown: number;
}

export const GARAGE_BAYS: GarageBay[] = CARS.map(({ id }) => ({
  id,
  spin: 0,
  x: 0,
  y: 0,
  roofY: 0,
  labelX: 0,
  labelY: 0,
  metre: 0,
  shown: 0,
}));

/** What each car shows the visitor he does with them. */
const FIX: CarId = 'golf2';
const RACE: CarId = 'forester';
const CLEAN: CarId = 'f30';
const LIFT_HEIGHT = 1.2;
const ROOF: Record<CarId, number> = {
  golf2: 1.45,
  mazda323f: 1.43,
  mazda3: 1.57,
  forester: 2.08,
  f30: 1.5,
};

/** Screen-right as seen from the camera road, (18, 7, 16) from the anchor: the row runs across the frame. */
const ACROSS = new THREE.Vector3(16, 0, -18).normalize();
const ROW_CENTRE = new THREE.Vector3(2, 0, 2);
/** On portrait screens the row stands further back, where the narrow frame is wide enough for all five. */
const ROW_CENTRE_NARROW = new THREE.Vector3(-1.5, 0, -1.5);
/** The yaw that points a car's nose (+x) straight at the camera. */
const FACING_CAMERA = Math.atan2(-16, 18);

const easeOutBack = (s: number) => 1 + 2.7 * (s - 1) ** 3 + 1.7 * (s - 1) ** 2;

/**
 * The finale: all five cars parked side by side in a studio-lit garage, angled like a showroom row.
 * The Golf is up on a lift with a wheel off (fix), the Forester wears rally lamps and trails speed lines
 * (race), the F30 is half foam, half shine (clean). Each car spins under the visitor's drag or keys.
 */
export const garage: ChapterBuilder = () => {
  const object = new THREE.Group();
  const random = seeded(11);

  const shell = new THREE.Group();
  const floor = new THREE.Mesh(floorGeometry(), lowPoly('concrete'));
  object.add(floor);
  shell.add(walls(), shutter(), pegboard(), tyres(random));
  object.add(shell);
  const lamps = glow('studio', 0);
  const tube = new THREE.BoxGeometry(2.4, 0.12, 0.16).translate(0, 5.4, 0);

  const bays = GARAGE_BAYS.map((bay) => {
    const group = new THREE.Group();
    const pivot = new THREE.Group();
    const car = parked(bay.id);
    pivot.add(car);
    // A strip light over each bay.
    group.add(pivot, new THREE.Mesh(tube, lamps));
    const idle: ((time: number) => void)[] = [];
    if (bay.id === FIX) fixProps(group, pivot);
    if (bay.id === RACE) idle.push(raceProps(pivot));
    if (bay.id === CLEAN) idle.push(cleanProps(group, pivot, random));
    object.add(group);
    return { bay, group, pivot, base: bay.id === FIX ? LIFT_HEIGHT : 0, turned: 0, idle };
  });

  let aspect = 0;
  const at = new THREE.Vector3();
  // The engine hands chapters no camera, so the floor reports where each car lands on screen as it is drawn.
  floor.onBeforeRender = (_renderer, _scene, camera) => {
    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.aspect !== aspect) layout((aspect = perspective.aspect));
    for (const { bay, group, pivot } of bays) {
      const lift = pivot.position.y;
      at.set(0, lift + ROOF[bay.id] / 2, 0)
        .applyMatrix4(group.matrixWorld)
        .project(camera);
      bay.x = at.x;
      bay.y = at.y;
      const behind = at.z > 1;
      at.set(0, lift + ROOF[bay.id], 0)
        .applyMatrix4(group.matrixWorld)
        .project(camera);
      bay.roofY = at.y;
      bay.metre = Math.abs(bay.roofY - bay.y) / (ROOF[bay.id] / 2);
      // Alternate label heights so neighbours never overlap, however tight the row.
      at.set(0, GARAGE_BAYS.indexOf(bay) % 2 ? 3.3 : 4.5, 0)
        .applyMatrix4(group.matrixWorld)
        .project(camera);
      bay.labelX = at.x;
      bay.labelY = at.y;
      bay.shown = behind
        ? 0
        : smoothstep(0.02, 0.01, Math.abs(1 - pivot.scale.x)) * (pivot.visible ? 1 : 0);
    }
  };

  /**
   * Spreads the row across the frame on wide screens; on narrow ones sets it back, packs it tighter and
   * turns the cars to face the camera, so all five still fit.
   */
  function layout(ratio: number): void {
    const wide = smoothstep(0.5, 1.5, ratio);
    const spacing = THREE.MathUtils.lerp(2.2, 3.6, wide);
    const angle = FACING_CAMERA - THREE.MathUtils.lerp(0.3, 0.8, wide);
    const centre = new THREE.Vector3().lerpVectors(ROW_CENTRE_NARROW, ROW_CENTRE, wide);
    bays.forEach(({ group }, i) => {
      group.position.copy(centre).addScaledVector(ACROSS, (i - 2) * spacing);
      group.rotation.y = angle;
    });
  }
  layout(16 / 9);

  return {
    object,
    update: ({ local, time }) => {
      const built = enter(local);
      shell.scale.y = Math.max(smoothstep(0, 0.5, built), 0.001);
      lamps.emissiveIntensity = 1.6 * smoothstep(0.3, 0.8, built);
      bays.forEach((b, i) => {
        // The cars drop in one after another as the camera arrives, in the order he owned them.
        const k = smoothstep(0.3 + i * 0.1, 0.6 + i * 0.1, built);
        b.pivot.visible = k > 0.01;
        b.pivot.scale.setScalar(Math.max(easeOutBack(k), 0.001));
        b.pivot.position.y = b.base + (1 - k) * 2.5;
        b.turned += (b.bay.spin - b.turned) * 0.18;
        b.pivot.rotation.y = b.turned;
        b.idle.forEach((f) => f(time));
      });
    },
  };
};

/** A car with its meshes merged per material: five or six draw calls instead of a dozen. */
function parked(id: CarId): THREE.Group {
  const car = buildCar(id);
  if (id === FIX) car.remove(car.children.filter((c) => c.name === 'wheel')[0]);
  const merged = new THREE.Group();
  merged.name = id;
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const child of car.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.updateMatrix();
    const geometry = (
      child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
    ).applyMatrix4(child.matrix);
    byMaterial.set(child.material, [...(byMaterial.get(child.material) ?? []), geometry]);
  }
  byMaterial.forEach((geometries, material) => {
    merged.add(new THREE.Mesh(mergeGeometries(geometries), material));
    geometries.forEach((g) => g.dispose());
  });
  car.traverse((obj) => obj instanceof THREE.Mesh && obj.geometry.dispose());
  return merged;
}

/** Fix: the Golf up on an in-ground lift, one wheel off and leaning on the post, the tool chest open beside it. */
function fixProps(group: THREE.Group, pivot: THREE.Group): void {
  const steel = lowPoly('steel');
  // The lift arms ride under the sills, so they turn with the car.
  pivot.add(
    merge(
      [
        box(3.2, 0.12, 0.16, 0, -0.06, 0.55),
        box(3.2, 0.12, 0.16, 0, -0.06, -0.55),
        box(0.3, 0.14, 1.4, 0, -0.1, 0),
      ],
      steel,
    ),
  );
  // The wheel that came off (front, camera side) lies on the floor by the post.
  const tyre = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 8)
    .rotateX(0.12)
    .translate(1.1, 0.13, -1.6);
  group.add(merge([tyre], lowPoly('soot')));
  // The lift post, and a red roll cab with a drawer open and a wrench on the floor.
  group.add(
    merge(
      [box(0.6, 1.0, 1.1, -2.6, 0.55, 1.4), box(0.64, 0.5, 1.14, -2.6, 1.3, 1.4)],
      lowPoly('brick'),
    ),
    merge(
      [
        new THREE.CylinderGeometry(0.2, 0.2, LIFT_HEIGHT, 8).translate(0, LIFT_HEIGHT / 2, 0),
        new THREE.CylinderGeometry(0.7, 0.8, 0.08, 8).translate(0, 0.04, 0),
        box(0.62, 0.06, 1.0, -2.6, 0.08, 1.4),
        box(0.9, 0.08, 0.95, -2.35, 0.9, 1.4),
        box(0.7, 0.04, 0.08, -0.4, 0.02, -2.3).rotateY(0.6),
        new THREE.TorusGeometry(0.09, 0.03, 4, 6).rotateX(Math.PI / 2).translate(-0.1, 0.03, -2.5),
      ],
      steel,
    ),
  );
}

/** Race: rally lamps on the nose, a door number roundel each side, and speed lines streaming off the tail. */
function raceProps(pivot: THREE.Group): (time: number) => void {
  const lamps = [-0.52, -0.18, 0.18, 0.52].map((z) =>
    new THREE.CylinderGeometry(0.13, 0.13, 0.08, 8).rotateZ(Math.PI / 2).translate(2.36, 1.02, z),
  );
  pivot.add(merge(lamps, glow('homeGlow', 1.4)));
  pivot.add(
    merge(
      [
        box(0.08, 0.06, 1.35, 2.32, 1.02, 0),
        new THREE.CylinderGeometry(0.3, 0.3, 0.02, 10)
          .rotateX(Math.PI / 2)
          .translate(-0.3, 0.85, 0.91),
        new THREE.CylinderGeometry(0.3, 0.3, 0.02, 10)
          .rotateX(Math.PI / 2)
          .translate(-0.3, 0.85, -0.91),
      ],
      lowPoly('studio'),
    ),
  );
  const material = glow('studio', 1.2);
  const line = new THREE.BoxGeometry(1, 0.08, 0.08);
  const lines = [
    [1.75, 0.55],
    [1.3, -0.7],
    [0.95, 0.75],
    [0.6, -0.2],
  ].map(([y, z], i) => {
    const mesh = new THREE.Mesh(line, material);
    mesh.position.set(-3, y, z);
    mesh.userData['phase'] = i / 4;
    pivot.add(mesh);
    return mesh;
  });
  return (time) => {
    for (const mesh of lines) {
      const s = (time * 0.9 + mesh.userData['phase']) % 1;
      mesh.scale.x = 2.6 * (1 - s) + 0.01;
      mesh.position.x = -2.45 - s * 2 - mesh.scale.x / 2;
    }
  };
}

/** Clean: foam on the bonnet and roof, the clean boot catching three twinkles, a bucket on the floor. */
function cleanProps(
  group: THREE.Group,
  pivot: THREE.Group,
  random: () => number,
): (time: number) => void {
  const blob = (x: number, y: number, z: number, r: number) =>
    new THREE.IcosahedronGeometry(r, 1)
      .scale(1, 0.6, 1)
      .rotateY(random() * 3)
      .translate(x, y, z);
  const foam: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++)
    foam.push(
      blob(
        1.1 + random() * 1.0,
        1.0 + random() * 0.05,
        (random() - 0.5) * 1.4,
        0.16 + random() * 0.14,
      ),
    );
  for (let i = 0; i < 7; i++)
    foam.push(blob(-0.8 + random() * 1.1, 1.48, (random() - 0.5) * 1.4, 0.16 + random() * 0.16));
  for (let i = 0; i < 4; i++)
    foam.push(blob(0.2 + random() * 1.4, 0.55 + random() * 0.3, -0.92, 0.1 + random() * 0.08));
  // Faintly self-lit so the foam reads white under the warm key, not as grey rubble.
  pivot.add(merge(foam, glow('studio', 0.35)));

  const star = mergeGeometries([
    new THREE.OctahedronGeometry(0.34, 0).scale(0.16, 1, 0.16),
    new THREE.OctahedronGeometry(0.34, 0).scale(0.16, 0.16, 1),
  ]);
  const shine = glow('studio', 2);
  const twinkles = [
    [-2.1, 1.2, -0.3],
    [-1.6, 1.2, 0.4],
    [-1.2, 0.8, -0.95],
  ].map(([x, y, z], i) => {
    const mesh = new THREE.Mesh(star, shine);
    mesh.position.set(x, y, z);
    mesh.userData['phase'] = i * 2.1;
    pivot.add(mesh);
    return mesh;
  });

  group.add(
    merge(
      [
        new THREE.CylinderGeometry(0.26, 0.2, 0.42, 8).translate(0.9, 0.21, -2.8),
        new THREE.TorusGeometry(0.24, 0.02, 3, 8, Math.PI).translate(0.9, 0.42, -2.8),
      ],
      lowPoly('steel'),
    ),
  );
  return (time) => {
    for (const mesh of twinkles) {
      const s = Math.max(Math.sin(time * 2.2 + mesh.userData['phase']), 0);
      mesh.scale.setScalar(0.2 + s * 0.9);
      mesh.rotation.x = time * 0.8;
    }
  };
}

/** A concrete slab with its front corner cut back from the road. */
function floorGeometry(): THREE.BufferGeometry {
  const corners: [number, number][] = [
    [-8.4, -8.4],
    [8.4, -8.4],
    [8.4, 1.4],
    [1.4, 8.4],
    [-8.4, 8.4],
  ];
  // Shape y is -z so that rotating onto the ground keeps the plan the right way round.
  const shape = new THREE.Shape(corners.map(([x, z]) => new THREE.Vector2(x, -z)));
  return new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false })
    .rotateX(-Math.PI / 2)
    .translate(0, -0.25, 0);
}

/** Two studio-white walls meeting in the far corner, so the room opens toward the road. */
function walls(): THREE.Mesh {
  return merge(
    [box(16.8, 7, 0.3, 0, 3.5, -8.25), box(0.3, 7, 16.5, -8.25, 3.5, 0.15)],
    lowPoly('studio'),
  );
}

/** A roller shutter in the back wall (header box and ribbed slats), and a pegboard on the side wall. */
function shutter(): THREE.Mesh {
  const parts = [
    box(4.9, 0.55, 0.5, 3.4, 3.95, -7.85),
    box(4.5, 3.6, 0.06, 3.4, 1.8, -8.07),
    box(0.06, 1.6, 3.4, -8.06, 2.6, -2.2),
  ];
  for (let y = 0.3; y < 3.6; y += 0.3) parts.push(box(4.5, 0.07, 0.08, 3.4, y, -8.02));
  parts.push(box(0.14, 3.7, 0.2, 1.08, 1.85, -8.0), box(0.14, 3.7, 0.2, 5.72, 1.85, -8.0));
  return merge(parts, lowPoly('concrete'));
}

/** The tools on the pegboard: a spanner, a hammer and a saw in outline. */
function pegboard(): THREE.Mesh {
  const x = -8.0;
  return merge(
    [
      box(0.05, 0.9, 0.08, x, 2.6, -3.4).rotateX(0),
      box(0.05, 0.12, 0.3, x, 3.0, -3.4),
      box(0.05, 0.75, 0.07, x, 2.55, -2.7),
      box(0.05, 0.22, 0.2, x, 2.95, -2.7),
      box(0.05, 0.28, 0.9, x, 2.7, -1.6),
      box(0.05, 0.4, 0.14, x, 2.6, -1.0),
      box(0.05, 0.08, 0.6, x, 2.1, -2.2),
      box(0.05, 0.08, 0.5, x, 3.2, -1.2),
    ],
    lowPoly('steel'),
  );
}

/** A stack of spare tyres in the corner. */
function tyres(random: () => number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(
      new THREE.CylinderGeometry(0.36, 0.36, 0.24, 8)
        .rotateY(random())
        .translate(-6.9 + (random() - 0.5) * 0.08, 0.12 + i * 0.25, -6.9),
    );
  }
  parts.push(
    new THREE.CylinderGeometry(0.36, 0.36, 0.24, 8)
      .rotateX(Math.PI / 2)
      .rotateY(0.5)
      .translate(-6.1, 0.36, -7.4),
  );
  return merge(parts, lowPoly('soot'));
}

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** One mesh from many parts sharing a material, so a prop costs one draw call. */
function merge(parts: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const mesh = new THREE.Mesh(mergeGeometries(flat), material);
  parts.forEach((g) => g.dispose());
  flat.forEach((g) => g.dispose());
  return mesh;
}
