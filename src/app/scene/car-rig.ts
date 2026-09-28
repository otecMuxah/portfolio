import * as THREE from 'three';
import { CARS, CarId } from '../content/life';
import { haloMap } from './art/kit';
import { PALETTE } from './art/palette';
import { buildCar, wheelRadius } from './cars';
import { assemblyOrder, partFlight } from './rebuild';

const SWAP_SECONDS = 0.9;
/** Assembly (#10): how high (m) a part arcs on its way from the light, and how far it has tumbled when it leaves. */
const ARC = 2.5;
const TUMBLE = 5;
const TUMBLE_AXIS = new THREE.Vector3(0.4, 1, 0.3).normalize();
/** How far back along its flight a part's streak of light reaches. */
const STREAK = 0.22;
const MAX_PARTS = 32;
const GLOW = new THREE.Color(PALETTE.lastLight);
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
  /** Each car's parts in assembly order, with where each sits when the car is whole. */
  private readonly parts = new Map<THREE.Group, { part: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion }[]>();
  /** Streaks of light behind the parts in flight, and a spark at each head: one shared geometry, rig space. */
  private readonly streaks: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly sparks: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private assembling?: THREE.Group;
  private readonly source = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly tumble = new THREE.Quaternion();

  // Everything starts visible so the engine's first compile covers it (compile skips hidden objects);
  // update() sets visibility before anything renders.
  constructor() {
    for (const { id } of CARS) {
      const car = buildCar(id);
      this.cars.set(id, car);
      this.parts.set(
        car,
        assemblyOrder(car).map((part) => ({ part, position: part.position.clone(), quaternion: part.quaternion.clone() })),
      );
      this.object.add(car);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    // The war's last light, carried into the car: additive, and like it untouched by fog and the grade.
    const light = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, fog: false };
    this.streaks = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial(light));
    this.sparks = new THREE.Points(geometry, new THREE.PointsMaterial({ ...light, map: haloMap(), size: 2.4 }));
    for (const o of [this.streaks, this.sparks]) {
      o.material.userData['ungraded'] = true;
      o.frustumCulled = false;
      o.visible = false;
      this.object.add(o);
    }
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#e8c89a', transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.object.add(this.ring);
  }

  /** Places the rig at `position` facing along `direction`, showing `carId` (or nothing). */
  update(carId: CarId | null, position: THREE.Vector3, direction: THREE.Vector3, time: number): void {
    if (carId !== this.shown) {
      this.outgoing = this.shown;
      this.shown = carId;
      this.swapStart = time;
      this.ring.material.color.set(this.cars.get((carId ?? this.outgoing)!)?.userData['colour'] ?? '#e8c89a');
    }
    const travelled = position.distanceTo(this.lastPosition);
    this.lastPosition.copy(position);
    this.object.position.copy(position);
    this.object.rotation.y = Math.atan2(-direction.z, direction.x);

    const s = THREE.MathUtils.clamp((time - this.swapStart) / SWAP_SECONDS, 0, 1);
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

  /**
   * The rebuild (#10): poses the shown car `k` (0..1) of the way assembled, each part flying home from `from` (world)
   * in assemblyOrder with a streak of light behind it. Pure of `k` and the rig's pose; at 1 the car is whole again.
   * Call after update().
   */
  assemble(k: number, from: THREE.Vector3): void {
    const car = this.shown ? this.cars.get(this.shown) : undefined;
    if (this.assembling && (this.assembling !== car || k >= 1)) {
      for (const { part, position, quaternion } of this.parts.get(this.assembling)!) {
        part.visible = true;
        part.position.copy(position);
        part.quaternion.copy(quaternion);
        part.scale.setScalar(1);
      }
      this.assembling = undefined;
    }
    this.streaks.visible = this.sparks.visible = !!car && k < 1;
    if (!car || k >= 1) return;
    this.assembling = car;
    this.object.updateMatrixWorld(true);
    car.worldToLocal(this.source.copy(from));
    const parts = this.parts.get(car)!;
    const position = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colour = this.streaks.geometry.getAttribute('color') as THREE.BufferAttribute;
    parts.forEach(({ part, position: home, quaternion }, i) => {
      const e = partFlight(k, i, parts.length);
      part.visible = e > 0;
      this.flight(e, home, part.position);
      part.scale.setScalar(0.3 + 0.7 * e);
      part.quaternion.copy(quaternion).premultiply(this.tumble.setFromAxisAngle(TUMBLE_AXIS, (1 - e) * TUMBLE * (i % 2 ? 1 : -1)));
      // Rig space: the car's own pose (a swap may be scaling it) carries the streak with it.
      this.at.copy(part.position).applyMatrix4(car.matrix);
      position.setXYZ(i * 2, this.at.x, this.at.y, this.at.z);
      this.flight(Math.max(e - STREAK, 0), home, this.at).applyMatrix4(car.matrix);
      position.setXYZ(i * 2 + 1, this.at.x, this.at.y, this.at.z);
      // Brightest as it leaves the light, gone as it lands; the streak's tail fades to nothing.
      const b = e < 1 ? 1 - e * e : 0;
      colour.setXYZ(i * 2, GLOW.r * b, GLOW.g * b, GLOW.b * b);
      colour.setXYZ(i * 2 + 1, 0, 0, 0);
    });
    this.streaks.geometry.setDrawRange(0, parts.length * 2);
    position.needsUpdate = colour.needsUpdate = true;
  }

  /** Where a part is `e` of the way home from the light, in car space: an arc up and over. */
  private flight(e: number, home: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(this.source, home, e);
    out.y += ARC * 4 * e * (1 - e);
    return out;
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
