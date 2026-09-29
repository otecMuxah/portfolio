import * as THREE from 'three';
import { cable, chair, deskLamp, droop, figure, rod, roomCorner, scotsPine, shelf } from './props';

const triangles = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;
const bounds = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

describe('props kit', () => {
  it('paints every part: non-indexed, vertex-coloured, without uvs', () => {
    const lamp = deskLamp();
    const parts = [
      rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 0), 0.05, 'soot'),
      cable(droop(new THREE.Vector3(0, 1, 0), new THREE.Vector3(2, 1, 0), 0.4)),
      roomCorner(4, 3, 2.5),
      chair('wooden'),
      chair('office'),
      lamp.body,
      lamp.lamp,
      shelf(1.2, { shelves: 3 }),
      figure(1),
      figure(2, { tabard: 'homeWarm', low: true }),
      scotsPine(1),
      scotsPine(1, { low: true }),
    ];
    for (const g of parts) {
      expect(g.index).toBeNull();
      expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
      expect(g.getAttribute('uv')).toBeUndefined();
      expect(triangles(g)).toBeGreaterThan(0);
    }
  });

  it('stands its pieces on y = 0 at their real size', () => {
    for (const g of [chair('wooden'), chair('office'), deskLamp().body, figure(3), scotsPine(3)]) expect(bounds(g).min.y).toBeCloseTo(0, 2);
    expect(bounds(figure(3)).max.y).toBeGreaterThan(1.6);
    expect(bounds(figure(3)).max.y).toBeLessThan(1.9);
    expect(bounds(chair('wooden')).max.y).toBeLessThan(1);
  });

  it('hangs a cable below the straight line between its ends, ends fixed', () => {
    const a = new THREE.Vector3(0, 1, 0);
    const b = new THREE.Vector3(2, 1, 0);
    const points = droop(a, b, 0.4, 4);
    expect(points.length).toBe(5);
    expect(points[0].equals(a)).toBe(true);
    expect(points[4].equals(b)).toBe(true);
    expect(points[2].y).toBeCloseTo(0.6, 6);
  });

  it('is seeded: the same seed builds the same piece, fewer triangles when low', () => {
    const same = (x: THREE.BufferGeometry, y: THREE.BufferGeometry) => Array.from(x.getAttribute('position').array).every((v, i) => v === y.getAttribute('position').array[i]);
    expect(same(figure(5), figure(5))).toBe(true);
    expect(same(shelf(1, { seed: 5 }), shelf(1, { seed: 5 }))).toBe(true);
    expect(triangles(figure(5, { low: true }))).toBeLessThan(triangles(figure(5)));
    expect(triangles(scotsPine(5, { low: true }))).toBeLessThan(triangles(scotsPine(5)));
  });
});
