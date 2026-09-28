import * as THREE from 'three';
import { CarId } from '../content/life';

type Profile = [x: number, y: number][];

/** Side profile of a low-poly car, front towards +x, ground at y = 0. */
interface CarModel {
  colour: string;
  width: number;
  wheelRadius: number;
  /** Front and rear axle x. */
  axles: [front: number, rear: number];
  /** Body below the beltline. */
  lower: Profile;
  /** Glasshouse on the beltline; its highest edge gets a body-coloured roof. */
  cabin: Profile;
  extras?: (car: THREE.Group, body: THREE.Material) => void;
}

const MODELS: Record<CarId, CarModel> = {
  // Boxy two-box hatch with an upright tailgate.
  golf2: {
    colour: '#c8202a',
    width: 1.7,
    wheelRadius: 0.33,
    axles: [1.2, -1.2],
    lower: [[-1.9, 0.3], [1.9, 0.3], [1.95, 0.72], [1.85, 0.92], [0.95, 0.97], [-1.85, 0.97], [-1.95, 0.7]],
    cabin: [[0.9, 0.97], [0.3, 1.42], [-1.45, 1.42], [-1.82, 0.97]],
  },
  // Low liftback whose roof runs in one long slope down to the tail.
  mazda323f: {
    colour: '#a3121c',
    width: 1.7,
    wheelRadius: 0.32,
    axles: [1.3, -1.3],
    lower: [[-2.15, 0.3], [2.15, 0.3], [2.22, 0.58], [2.05, 0.8], [0.9, 0.95], [-2.05, 0.98], [-2.2, 0.66]],
    cabin: [[0.85, 0.95], [0.1, 1.38], [-0.7, 1.4], [-2.05, 0.98]],
    extras: (car, body) => car.add(box([0.12, 0.05, 1.5], [-2.05, 1.03, 0], body)),
  },
  // Rounded five-door hatch with a raked windscreen.
  mazda3: {
    colour: '#1f5fbf',
    width: 1.75,
    wheelRadius: 0.34,
    axles: [1.35, -1.35],
    lower: [[-2.2, 0.3], [2.2, 0.3], [2.27, 0.68], [2.1, 0.9], [1, 1.02], [-2.15, 1.05], [-2.25, 0.7]],
    cabin: [[0.95, 1.02], [0.2, 1.52], [-1.1, 1.54], [-1.85, 1.35], [-2.1, 1.05]],
  },
  // Tall estate-shaped SUV: high ground clearance, big wheels, roof rails.
  forester: {
    colour: '#2f7d3a',
    width: 1.8,
    wheelRadius: 0.42,
    axles: [1.35, -1.35],
    lower: [[-2.25, 0.45], [2.25, 0.45], [2.3, 0.95], [2.2, 1.2], [1.2, 1.28], [-2.2, 1.3], [-2.3, 0.95]],
    cabin: [[1.15, 1.28], [0.55, 1.92], [-1.95, 1.94], [-2.15, 1.3]],
    extras: (car) => {
      const rail = new THREE.MeshStandardMaterial({ color: '#2a2a2a', flatShading: true });
      for (const z of [-0.7, 0.7]) car.add(box([2.2, 0.06, 0.06], [-0.7, 2.05, z], rail));
    },
  },
  // Long, low three-box saloon with a boot and a twin kidney grille.
  f30: {
    colour: '#24272e',
    width: 1.8,
    wheelRadius: 0.34,
    axles: [1.4, -1.4],
    lower: [[-2.3, 0.3], [2.3, 0.3], [2.36, 0.68], [2.2, 0.9], [1.1, 1], [-1.55, 1.05], [-2.3, 1.02], [-2.36, 0.68]],
    cabin: [[1.05, 1], [0.35, 1.45], [-0.9, 1.47], [-1.55, 1.05]],
    extras: (car) => {
      // Low metalness: there is no env map, so a metallic grille would reflect nothing and read black.
      const grille = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.2, roughness: 0.4 });
      for (const z of [-0.17, 0.17]) car.add(named('grille', box([0.08, 0.18, 0.26], [2.33, 0.78, z], grille)));
    },
  },
};

const GLASS = new THREE.MeshStandardMaterial({ color: '#43546a', metalness: 0.4, roughness: 0.2, flatShading: true });
const TYRE = new THREE.MeshStandardMaterial({ color: '#141414', flatShading: true });
const HEADLIGHT = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#fff4d6', emissiveIntensity: 1.5 });
const TAILLIGHT = new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 1.5 });

/** Builds a car as a group; its parts are named (wheels as `wheel`) so the rig can spin and the rebuild assemble them. */
export function buildCar(carId: CarId): THREE.Group {
  const model = MODELS[carId];
  const body = new THREE.MeshStandardMaterial({
    color: model.colour,
    flatShading: true,
    metalness: 0.2,
    roughness: 0.45,
  });
  const car = new THREE.Group();
  car.name = carId;
  car.userData['colour'] = model.colour;
  car.add(named('body', extrude(model.lower, model.width, body)));
  car.add(named('cabin', extrude(model.cabin, model.width - 0.2, GLASS)));

  const roofY = Math.max(...model.cabin.map(([, y]) => y));
  const roofXs = model.cabin.filter(([, y]) => y > roofY - 0.05).map(([x]) => x);
  const roofMin = Math.min(...roofXs);
  const roofMax = Math.max(...roofXs);
  car.add(named('roof', box([roofMax - roofMin + 0.1, 0.06, model.width - 0.14], [(roofMin + roofMax) / 2, roofY + 0.03, 0], body)));

  const front = Math.max(...model.lower.map(([x]) => x));
  const rear = Math.min(...model.lower.map(([x]) => x));
  const lightY = model.lower[2][1] + 0.05;
  for (const z of [-1, 1].map((s) => s * (model.width / 2 - 0.25))) {
    car.add(named('headlight', box([0.06, 0.12, 0.3], [front - 0.02, lightY, z], HEADLIGHT)));
    car.add(named('taillight', box([0.06, 0.12, 0.3], [rear + 0.02, lightY, z], TAILLIGHT)));
  }

  const r = model.wheelRadius;
  const tyre = new THREE.CylinderGeometry(r, r, 0.28, 8).rotateX(Math.PI / 2);
  for (const x of model.axles) {
    for (const z of [-1, 1].map((s) => s * (model.width / 2 - 0.1))) {
      const wheel = new THREE.Mesh(tyre, TYRE);
      wheel.name = 'wheel';
      wheel.position.set(x, r, z);
      car.add(wheel);
    }
  }
  model.extras?.(car, body);
  return car;
}

export function wheelRadius(carId: CarId): number {
  return MODELS[carId].wheelRadius;
}

function named<T extends THREE.Object3D>(name: string, object: T): T {
  object.name = name;
  return object;
}

function extrude(profile: Profile, depth: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
}

function box(size: [number, number, number], at: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...at);
  return mesh;
}
