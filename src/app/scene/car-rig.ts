import * as THREE from 'three';
import { CARS, CarId } from '../content/life';
import { buildCar, wheelRadius } from './cars';

const SWAP_SECONDS = 0.9;
const easeOutBack = (s: number) => 1 + 2.7 * (s - 1) ** 3 + 1.7 * (s - 1) ** 2;

/**
 * The car that carries the camera. Rides the path in front of it; when the
 * car changes, the old one spins down into the ground, a dust ring bursts
 * and the new one drops in.
 */
export class CarRig {
  readonly object = new THREE.Group();
  private readonly cars = new Map<CarId, THREE.Group>();
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly lastPosition = new THREE.Vector3();
  private shown: CarId | null = null;
  private outgoing: CarId | null = null;
  private swapStart = -Infinity;

  // Everything starts visible so the engine's first compile covers it (compile skips hidden objects);
  // update() sets visibility before anything renders.
  constructor() {
    for (const { id } of CARS) {
      const car = buildCar(id);
      this.cars.set(id, car);
      this.object.add(car);
    }
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#e8c89a', transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.object.add(this.ring);
  }

  /**
   * Places the rig at `position` facing along `direction`, showing `carId` (or nothing). `arrival` below 1 poses the
   * swap by scroll instead of the clock (the first car pulling up beside him, #46): nothing spins out, and the drop-in
   * is that far along.
   */
  update(carId: CarId | null, position: THREE.Vector3, direction: THREE.Vector3, time: number, arrival = 1): void {
    if (carId !== this.shown) {
      this.outgoing = this.shown;
      this.shown = carId;
      this.swapStart = time;
      this.ring.material.color.set(this.cars.get((carId ?? this.outgoing)!)?.userData['colour'] ?? '#e8c89a');
    }
    if (arrival < 1) {
      this.outgoing = null;
      this.swapStart = -Infinity;
    }
    const travelled = position.distanceTo(this.lastPosition);
    this.lastPosition.copy(position);
    this.object.position.copy(position);
    this.object.rotation.y = Math.atan2(-direction.z, direction.x);

    const s = arrival < 1 ? arrival : THREE.MathUtils.clamp((time - this.swapStart) / SWAP_SECONDS, 0, 1);
    this.cars.forEach((car, id) => {
      car.visible = false;
      if (id === this.outgoing && s < 0.5) {
        const k = s / 0.5;
        this.pose(car, 1 - k, -k * 0.8, k * Math.PI);
      } else if (id === this.shown) {
        const k = THREE.MathUtils.clamp((s - 0.35) / 0.65, 0, 1);
        this.pose(car, easeOutBack(k), (1 - k) * 2.5, 0);
        if (travelled < 5) this.spinWheels(car, travelled / wheelRadius(id));
      }
    });

    this.ring.visible = s < 1 && (this.shown !== null || this.outgoing !== null);
    this.ring.scale.setScalar(0.5 + s * 4);
    this.ring.material.opacity = 0.9 * (1 - s);
  }

  private pose(car: THREE.Group, scale: number, y: number, spin: number): void {
    car.visible = scale > 0.01;
    car.scale.setScalar(Math.max(scale, 0.001));
    car.position.y = y;
    car.rotation.y = spin;
  }

  private spinWheels(car: THREE.Group, angle: number): void {
    for (const child of car.children) if (child.name === 'wheel') child.rotation.z -= angle;
  }
}
