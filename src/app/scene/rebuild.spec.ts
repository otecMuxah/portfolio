import * as THREE from 'three';
import { chapterSpans } from '../journey/journey';
import { CarRig } from './car-rig';
import { stubCanvas } from './chapters/scene-contract';
import { buildCar } from './cars';
import { F30_ASSEMBLY, assemblyOrder, f30Assembled, partFlight } from './rebuild';

const spans = chapterSpans();
const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

describe('f30Assembled', () => {
  it('is nothing through the war, builds early in Ciklum and stays whole after', () => {
    for (const p of [0, at('back-home', 0.5), at('war', 0.999), at('ciklum', 0), at('ciklum', F30_ASSEMBLY.start)]) {
      expect(f30Assembled(p)).toBeCloseTo(0, 9);
    }
    expect(f30Assembled(at('ciklum', (F30_ASSEMBLY.start + F30_ASSEMBLY.end) / 2))).toBeCloseTo(0.5);
    for (const p of [at('ciklum', F30_ASSEMBLY.end + 0.01), at('ciklum', 0.5), at('iata', 0.5), 1]) expect(f30Assembled(p)).toBe(1);
  });
});

describe('assemblyOrder', () => {
  it('puts the real F30 together chassis first and lights last, every part once', () => {
    const car = buildCar('f30');
    const order = assemblyOrder(car);
    expect(new Set(order)).toEqual(new Set(car.children));
    const names = order.map((p) => p.name);
    const wheels = names.filter((n) => n === 'wheel').length;
    expect(wheels).toBe(4);
    expect(names.slice(0, wheels).every((n) => n === 'wheel')).toBe(true);
    expect(names[wheels]).toBe('body');
    expect(names[names.length - 1]).toBe('headlight');
    expect(names.indexOf('cabin')).toBeLessThan(names.indexOf('roof'));
    expect(names.lastIndexOf('taillight')).toBeLessThan(names.indexOf('headlight'));
  });

  it('is the same order every time it is built', () => {
    expect(assemblyOrder(buildCar('f30')).map((p) => p.name)).toEqual(assemblyOrder(buildCar('f30')).map((p) => p.name));
  });
});

describe('partFlight', () => {
  const n = 13;

  it('has nothing out at 0, everything home at 1, and each part leaving after the one before', () => {
    for (let i = 0; i < n; i++) {
      expect(partFlight(0, i, n)).toBe(0);
      expect(partFlight(1, i, n)).toBe(1);
    }
    for (let k = 0.05; k < 1; k += 0.05) {
      for (let i = 1; i < n; i++) expect(partFlight(k, i, n)).toBeLessThanOrEqual(partFlight(k, i - 1, n));
    }
  });

  it('comes from k alone, so scrolling back takes the car apart through the same poses', () => {
    const steps = Array.from({ length: 101 }, (_, s) => s / 100);
    const forward = steps.map((k) => Array.from({ length: n }, (_, i) => partFlight(k, i, n)));
    const back = [...steps].reverse().map((k) => Array.from({ length: n }, (_, i) => partFlight(k, i, n))).reverse();
    expect(back).toEqual(forward);
  });
});

describe('CarRig.assemble', () => {
  beforeAll(stubCanvas);

  const pose = (rig: CarRig) => {
    const f30 = rig.object.getObjectByName('f30')!;
    return f30.children.map((p) => [p.visible, ...p.position.toArray().map((v) => +v.toFixed(5)), p.scale.x.toFixed(5)]);
  };
  const place = (rig: CarRig, k: number) => {
    rig.update('f30', new THREE.Vector3(12, 0, 2), new THREE.Vector3(0, 0, -1), 100);
    rig.assemble(k, new THREE.Vector3(0, 6, -10));
  };

  it('starts from nothing, is whole at 1, and poses the same for the same k whichever way it is reached', () => {
    const rig = new CarRig();
    place(rig, 1);
    const whole = pose(rig);
    place(rig, 0);
    expect(rig.object.getObjectByName('f30')!.children.every((p) => !p.visible)).toBe(true);
    place(rig, 0.4);
    const forward = pose(rig);
    place(rig, 0.8);
    place(rig, 0.4);
    expect(pose(rig)).toEqual(forward);
    place(rig, 1);
    expect(pose(rig)).toEqual(whole);
  });
});
