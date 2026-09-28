import * as THREE from 'three';
import { CARS, CHAPTERS } from '../../content/life';
import { ChapterScene } from '../chapter-scene';
import { CHAPTER_BUILDERS } from '.';
import { GARAGE_BAYS } from './garage';

const CAR_IDS = new Set<string>(CARS.map((c) => c.id));
const INDEX = CHAPTERS.findIndex((c) => c.id === 'garage');

function build(): ChapterScene {
  return CHAPTER_BUILDERS[CHAPTERS[INDEX].scene](CHAPTERS[INDEX], INDEX);
}

/** Draws the garage once for a camera on the road at a chapter's midpoint, as the engine frames it. */
function view(scene: ChapterScene, aspect: number): void {
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 500);
  camera.position.set(18, 7, 16);
  camera.lookAt(0, 3, 0);
  camera.updateMatrixWorld();
  scene.object.updateMatrixWorld(true);
  const floor = scene.object.children[0];
  floor.onBeforeRender(
    null as never,
    null as never,
    camera,
    null as never,
    null as never,
    null as never,
  );
  scene.object.updateMatrixWorld(true);
  floor.onBeforeRender(
    null as never,
    null as never,
    camera,
    null as never,
    null as never,
    null as never,
  );
}

/** Draw calls and triangles, split into the five parked cars and the garage's own set. */
function stats(object: THREE.Object3D) {
  const own = { triangles: 0, drawCalls: 0, lights: 0 };
  const cars = new Map<string, number>();
  const visit = (obj: THREE.Object3D, car: string | null) => {
    const inCar = car ?? (CAR_IDS.has(obj.name) ? obj.name : null);
    if (obj instanceof THREE.Light) own.lights++;
    if (obj instanceof THREE.Mesh) {
      if (inCar) cars.set(inCar, (cars.get(inCar) ?? 0) + 1);
      else {
        own.drawCalls++;
        const g = obj.geometry;
        own.triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      }
    }
    obj.children.forEach((c) => visit(c, inCar));
  };
  visit(object, null);
  return { own, cars };
}

function vertices(object: THREE.Object3D): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  object.updateMatrixWorld(true);
  object.traverseVisible((obj) => {
    if (obj instanceof THREE.Mesh) {
      const pos = obj.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++)
        out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld));
    }
  });
  return out;
}

describe('garage scene', () => {
  afterEach(() => GARAGE_BAYS.forEach((bay) => (bay.spin = 0)));

  it('is the garage chapter’s own scene', () => {
    expect(CHAPTERS[INDEX].scene).toBe('garage');
  });

  it('parks all five cars, each once', () => {
    const { cars } = stats(build().object);
    expect([...cars.keys()].sort()).toEqual([...CAR_IDS].sort());
  });

  it('keeps its own set within budget, with no lights, and merges each car to a few draw calls', () => {
    const scene = build();
    scene.update?.({ progress: 1, local: 0.5, time: 3 });
    const { own, cars } = stats(scene.object);
    expect(own.triangles).toBeLessThanOrEqual(5000);
    expect(own.drawCalls).toBeLessThanOrEqual(25);
    expect(own.lights).toBe(0);
    cars.forEach((drawCalls) => expect(drawCalls).toBeLessThanOrEqual(7));
  });

  for (const [screen, aspect] of [
    ['desktop', 1440 / 900],
    ['phone', 390 / 844],
  ] as const) {
    it(`stays inside its 12 m plot and 22 m height on a ${screen}, even with every car spun`, () => {
      const scene = build();
      view(scene, aspect);
      GARAGE_BAYS.forEach((bay, i) => (bay.spin = i * 0.7));
      for (let i = 0; i < 60; i++) scene.update?.({ progress: 1, local: 0.5, time: i / 60 });
      for (const v of vertices(scene.object)) {
        expect(v.y).toBeLessThanOrEqual(22);
        expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(12);
      }
    });

    it(`frames all five cars left to right in the order he owned them on a ${screen}`, () => {
      const scene = build();
      scene.update?.({ progress: 1, local: 0.5, time: 3 });
      view(scene, aspect);
      GARAGE_BAYS.forEach((bay) => {
        expect(bay.shown, bay.id).toBe(1);
        expect(Math.abs(bay.x), bay.id).toBeLessThan(0.95);
        expect(Math.abs(bay.y), bay.id).toBeLessThan(0.95);
        expect(bay.labelY, bay.id).toBeGreaterThan(bay.roofY);
      });
      const xs = GARAGE_BAYS.map((bay) => bay.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });
  }

  it('builds from scroll alone: the same local gives the same garage, whichever way it was reached', () => {
    const scene = build();
    const pose = (local: number) => {
      scene.update?.({ progress: 1, local, time: 3 });
      return vertices(scene.object).map((v) =>
        v
          .toArray()
          .map((n) => n.toFixed(3))
          .join(),
      );
    };
    const forward = pose(0);
    pose(1);
    expect(pose(0)).toEqual(forward);
  });

  it('shows no car until the camera nears the garage', () => {
    const scene = build();
    scene.update?.({ progress: 0.9, local: -1, time: 0 });
    view(scene, 16 / 9);
    GARAGE_BAYS.forEach((bay) => expect(bay.shown, bay.id).toBe(0));
  });

  it('eases a car round to the spin the visitor asked for', () => {
    const scene = build();
    const f30 = scene.object.getObjectByName('f30')!.parent!;
    GARAGE_BAYS.find((b) => b.id === 'f30')!.spin = 1.5;
    for (let i = 0; i < 60; i++) scene.update?.({ progress: 1, local: 0.5, time: i / 60 });
    expect(f30.rotation.y).toBeCloseTo(1.5, 3);
    expect(scene.object.getObjectByName('golf2')!.parent!.rotation.y).toBe(0);
  });
});
