import * as THREE from 'three';
import { kharkivSkyline, kharkivSkylinePoints } from './kharkiv';

describe('Kharkiv skyline', () => {
  it('leads with Derzhprom as the tallest mass', () => {
    const skyline = kharkivSkyline();
    const derzhprom = skyline.getObjectByName('derzhprom') as THREE.Mesh;
    expect(derzhprom).toBeDefined();
    const top = (obj: THREE.Object3D) => new THREE.Box3().setFromObject(obj).max.y;
    expect(top(derzhprom)).toBe(top(skyline));
  });

  it('samples the same points for the same seed and different ones for another', () => {
    const a = kharkivSkylinePoints(300, 5);
    expect(a.length).toBe(900);
    expect([...a]).toEqual([...kharkivSkylinePoints(300, 5)]);
    expect([...a]).not.toEqual([...kharkivSkylinePoints(300, 6)]);
  });

  it('puts every point on the skyline, not in the air around it', () => {
    const box = new THREE.Box3().setFromObject(kharkivSkyline()).expandByScalar(0.06);
    const points = kharkivSkylinePoints(500, 1);
    const p = new THREE.Vector3();
    for (let i = 0; i < 500; i++) expect(box.containsPoint(p.fromArray(points, i * 3))).toBe(true);
  });
});
