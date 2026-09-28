import * as THREE from 'three';
import { CHAPTERS, ChapterId } from '../../content/life';
import { built, sceneContract, stubCanvas } from './scene-contract';

const REBUILD: ChapterId[] = ['ciklum', 'iata'];

/** Instances standing (non-zero scale) across a scene's instanced meshes. */
function standing(id: ChapterId, local: number): number {
  let n = 0;
  const m = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  built(id, local).traverseVisible((o) => {
    if (!(o instanceof THREE.InstancedMesh)) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      scale.setFromMatrixScale(m);
      if (scale.x * scale.y * scale.z > 1e-9) n++;
    }
  });
  return n;
}

describe('rebuild scenes', () => {
  beforeAll(stubCanvas);

  it('each has its own scene in the rebuild phase, not the placeholder', () => {
    const chapters = REBUILD.map((id) => CHAPTERS.find((c) => c.id === id)!);
    expect(chapters.map((c) => c.scene)).toEqual(REBUILD);
    for (const c of chapters) expect(c.phase).toBe('rebuild');
  });

  it('Ciklum starts from nothing and goes up piece by piece as the scroll goes on', () => {
    expect(standing('ciklum', 0)).toBe(0);
    let last = 0;
    for (const local of [0.2, 0.3, 0.4, 0.5, 0.6]) {
      const n = standing('ciklum', local);
      expect(n).toBeGreaterThan(last);
      last = n;
    }
  });

  it('Frankfurt rises as the camera comes in, and planes cross it on their arcs by scroll alone', () => {
    expect(standing('iata', -0.6)).toBe(0);
    expect(standing('iata', 0.5)).toBeGreaterThan(standing('iata', -0.2));
    // The same local puts every plane in the same place, whatever the idle time says it is doing.
    const planes = (time: number) => {
      const out: number[] = [];
      built('iata', 0.5, time).traverse((o) => {
        if (o instanceof THREE.InstancedMesh && o.count === 3) {
          const m = new THREE.Matrix4();
          for (let i = 0; i < 3; i++) out.push(new THREE.Vector3().setFromMatrixPosition(o.getMatrixAt(i, m)).x);
        }
      });
      return out;
    };
    expect(planes(1)).toHaveLength(3);
    planes(1).forEach((x, i) => expect(x).toBeCloseTo(planes(40)[i], 5));
  });

  REBUILD.forEach(sceneContract);
});
