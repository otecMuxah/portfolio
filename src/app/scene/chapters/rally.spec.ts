import * as THREE from 'three';
import { CHAPTERS } from '../../content/life';
import { CHAPTER_BUILDERS } from '.';

const index = CHAPTERS.findIndex((c) => c.id === 'rally');

/** Builds the rally scene and poses it at a local progress, as the engine would. */
function built(local: number, time = 3) {
  const scene = CHAPTER_BUILDERS[CHAPTERS[index].scene](CHAPTERS[index], index);
  scene.update?.({ progress: 0, local, time });
  scene.object.updateMatrixWorld(true);
  return scene;
}

/** Road surface and dust live on the car's road by design; everything else is scenery. */
const onRoad = (obj: THREE.Object3D) => obj.name === 'stage-road' || obj.name === 'dust' || obj.parent?.name === 'stage-road';

function vertices(obj: THREE.Mesh | THREE.Points): THREE.Vector3[] {
  const pos = obj.geometry.getAttribute('position');
  return Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld));
}

function scenery(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  object.traverseVisible((obj) => obj instanceof THREE.Mesh && !onRoad(obj) && meshes.push(obj));
  return meshes;
}

describe('rally scene', () => {
  // jsdom has no 2D canvas; the dust's round gradient only needs somewhere to draw.
  beforeAll(() => {
    const ctx = { createRadialGradient: () => ({ addColorStop: () => undefined }), fillRect: () => undefined };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  });

  it('renders the rally chapter with its own builder', () => {
    expect(CHAPTERS[index].scene).toBe('rally');
  });

  it('stays within the per-chapter budget and adds no lights', () => {
    let triangles = 0;
    let drawCalls = 0;
    let particles = 0;
    let lights = 0;
    built(0.5).object.traverse((obj) => {
      if (obj instanceof THREE.Light) lights++;
      if (obj instanceof THREE.Points) {
        drawCalls++;
        particles += obj.geometry.getAttribute('position').count;
      } else if (obj instanceof THREE.Mesh) {
        drawCalls++;
        const g = obj.geometry;
        const count = obj instanceof THREE.InstancedMesh ? obj.count : 1;
        triangles += ((g.index ? g.index.count : g.getAttribute('position').count) / 3) * count;
        if (obj instanceof THREE.InstancedMesh) particles += obj.count;
      }
    });
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(drawCalls).toBeLessThanOrEqual(25);
    expect(particles).toBeLessThanOrEqual(1500);
    expect(lights).toBe(0);
  });

  it('keeps its scenery inside the 12 m plot and out of the car lane, before, during and after the camera', () => {
    for (const local of [-0.5, 0, 0.5, 1, 2]) {
      const { object } = built(local);
      const lane = object.getObjectByName('stage-road')!.parent!;
      for (const mesh of scenery(object)) {
        for (const v of vertices(mesh)) {
          expect(v.y, `height at local ${local}`).toBeLessThanOrEqual(22);
          expect(Math.hypot(v.x, v.z), `plot at local ${local}`).toBeLessThanOrEqual(12);
          // Lane frame z runs across the road. Nothing stands within 3 m of the car's line (the car is
          // 1.8 m wide); only the flat forest floor runs under the road's verge.
          if (v.y > 0.05) expect(Math.abs(lane.worldToLocal(v).z), `lane at local ${local}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('lays the gravel flat under the lane the car rides', () => {
    const { object } = built(0.5);
    const road = object.getObjectByName('stage-road')!;
    // The engine's car rides the anchor plus CAR_OFFSET (12, 0, 2) at the chapter midpoint.
    expect(road.parent!.position.toArray()).toEqual([12, 0, 2]);
    road.traverse((obj) => {
      if (obj instanceof THREE.Mesh) vertices(obj).forEach((v) => expect(Math.abs(v.y)).toBeLessThan(0.1));
    });
  });

  it('raises dust only once the car has passed, and lets it settle', () => {
    const puffs = (local: number) => {
      const mesh = built(local).object.getObjectByName('dust') as THREE.InstancedMesh;
      const m = new THREE.Matrix4();
      return Array.from({ length: mesh.count }, (_, i) => {
        mesh.getMatrixAt(i, m);
        return new THREE.Vector3().setFromMatrixScale(m).x > 0.01;
      }).filter(Boolean).length;
    };
    expect(puffs(-0.5)).toBe(0);
    expect(puffs(0.5)).toBeGreaterThan(10);
    expect(puffs(3)).toBe(0);
  });

  it('builds from scroll alone: the same local gives the same scene, whichever way it was reached', () => {
    const scene = built(0);
    const pose = () => {
      scene.object.updateMatrixWorld(true);
      const out: number[] = [];
      scene.object.traverse((obj) => {
        out.push(...obj.matrixWorld.elements);
        if (obj instanceof THREE.InstancedMesh) out.push(...obj.instanceMatrix.array);
        if (obj instanceof THREE.Points) out.push(...(obj.geometry.getAttribute('position').array as Float32Array));
      });
      return out.map((v) => v.toFixed(3));
    };
    const forward = pose();
    scene.update?.({ progress: 0, local: 2, time: 3 });
    scene.update?.({ progress: 0, local: 0, time: 3 });
    expect(pose()).toEqual(forward);
  });
});
