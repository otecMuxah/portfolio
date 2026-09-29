import * as THREE from 'three';
import { CARS } from '../content/life';
import { buildCar } from './cars';
import { stats, stubCanvas } from './chapters/scene-contract';
import { Shatter } from './shatter';

describe('buildCar', () => {
  beforeAll(stubCanvas);

  it('dresses every car in at most 11 draw calls and 900 triangles, no lights', () => {
    for (const { id } of CARS) {
      const { drawCalls, triangles, lights } = stats(buildCar(id));
      // 11 to 13 calls before #72 dressed them: the lamps now draw once a car, and the trim is one painted mesh.
      expect(drawCalls, id).toBeLessThanOrEqual(11);
      expect(triangles, id).toBeLessThanOrEqual(900);
      expect(lights, id).toBe(0);
    }
  });

  it('keeps its trim out of the shatter, and the body, lamps and wheels in it', () => {
    const car = buildCar('f30');
    const trim = car.getObjectByName('trim')!;
    expect(trim.userData['detail']).toBe(true);
    const whole = new Shatter([car]).stats.triangles;
    car.remove(trim);
    expect(new Shatter([car]).stats.triangles).toBe(whole);
    expect(whole).toBeGreaterThan(0);
  });

  it('turns each wheel face with its tyre, facing out on both sides', () => {
    const car = buildCar('golf2');
    const wheels = car.children.filter((c): c is THREE.Mesh => c.name === 'wheel');
    expect(wheels.length).toBe(4);
    for (const wheel of wheels) {
      wheel.geometry.computeBoundingBox();
      const { min, max } = wheel.geometry.boundingBox!;
      // The face stands proud of the tyre on the outside only: the car's side of the wheel is bare tyre.
      const out = Math.sign(wheel.position.z);
      expect(out > 0 ? max.z : -min.z).toBeGreaterThan(0.14);
      expect(out > 0 ? -min.z : max.z).toBeCloseTo(0.14, 5);
      // Face normals on the outer face point out.
      const normal = wheel.geometry.getAttribute('normal');
      const position = wheel.geometry.getAttribute('position');
      let outward = 0;
      for (let i = 0; i < position.count; i++) if (position.getZ(i) * out > 0.141) outward += Math.sign(normal.getZ(i) * out);
      expect(outward).toBeGreaterThan(0);
    }
  });
});
