import * as THREE from 'three';
import { CHAPTERS, ChapterId } from '../../content/life';
import { CHAPTER_BUILDERS } from '.';

const EARLY: ChapterId[] = ['birth', 'school', 'lyceum', 'university', 'dreamweaver', 'family'];

/** Builds a chapter's scene and poses it at a local progress, as the engine would. */
function built(id: ChapterId, local: number, time = 3) {
  const index = CHAPTERS.findIndex((c) => c.id === id);
  const scene = CHAPTER_BUILDERS[CHAPTERS[index].scene](CHAPTERS[index], index);
  scene.update?.({ progress: 0, local, time });
  scene.object.updateMatrixWorld(true);
  return scene.object;
}

function stats(object: THREE.Object3D) {
  let triangles = 0;
  let drawCalls = 0;
  let particles = 0;
  let lights = 0;
  object.traverse((obj) => {
    if (obj instanceof THREE.Light) lights++;
    if (obj instanceof THREE.Points) {
      drawCalls++;
      particles += obj.geometry.getAttribute('position').count;
    } else if (obj instanceof THREE.Mesh) {
      drawCalls++;
      const g = obj.geometry;
      triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    } else if (obj instanceof THREE.Line) drawCalls++;
    else if (obj instanceof THREE.Sprite) {
      drawCalls++;
      triangles += 2;
    }
  });
  return { triangles, drawCalls, particles, lights };
}

/** Every visible vertex, in world space. */
function vertices(object: THREE.Object3D): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  object.traverseVisible((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      const pos = obj.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld));
    }
  });
  return out;
}

/** World-space boxes of what could stand in the car's way: a box per mesh or line, a point per particle. */
function solids(object: THREE.Object3D): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];
  object.traverseVisible((obj) => {
    if (obj instanceof THREE.Points) {
      vertices(obj).forEach((p) => boxes.push(new THREE.Box3(p, p.clone())));
    } else if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
      obj.geometry.computeBoundingBox();
      boxes.push(obj.geometry.boundingBox!.clone().applyMatrix4(obj.matrixWorld));
    }
  });
  return boxes;
}

const CAR_LANE = new THREE.Box3(new THREE.Vector3(-3, -Infinity, 4), new THREE.Vector3(3, Infinity, 14));
/** The road and the car pass front-right of each subject; that quadrant stays open. */
const ROAD_SIDE = new THREE.Box3(new THREE.Vector3(4, -Infinity, 4), new THREE.Vector3(Infinity, Infinity, Infinity));

describe('early-life scenes', () => {
  // jsdom has no 2D canvas; the halo gradient only needs somewhere to draw.
  beforeAll(() => {
    const ctx = { createRadialGradient: () => ({ addColorStop: () => undefined }), fillRect: () => undefined };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  });

  it('each chapter 1–6 has its own scene, not the placeholder', () => {
    const kinds = EARLY.map((id) => CHAPTERS.find((c) => c.id === id)!.scene);
    expect(kinds).not.toContain('placeholder');
    expect(new Set(kinds).size).toBe(EARLY.length);
  });

  for (const id of EARLY) {
    describe(id, () => {
      it('stays within the per-chapter budget', () => {
        const { triangles, drawCalls, particles, lights } = stats(built(id, 0.5));
        expect(triangles).toBeLessThanOrEqual(5000);
        expect(drawCalls).toBeLessThanOrEqual(25);
        expect(particles).toBeLessThanOrEqual(1500);
        // Real lights cost every fragment in the world; chapters fake theirs with glow and halos.
        expect(lights).toBe(0);
      });

      it('keeps the car lane and the road side clear and stays inside its 12 m plot, before, during and after the camera', () => {
        for (const local of [-0.5, 0, 0.5, 1, 2]) {
          const scene = built(id, local);
          for (const box of solids(scene)) {
            expect(box.intersectsBox(CAR_LANE), `${id} lane at local ${local}`).toBe(false);
            expect(box.intersectsBox(ROAD_SIDE), `${id} road side at local ${local}`).toBe(false);
          }
          for (const v of vertices(scene)) {
            expect(v.y, `${id} at local ${local}`).toBeLessThanOrEqual(22);
            expect(Math.hypot(v.x, v.z), `${id} at local ${local}`).toBeLessThanOrEqual(12);
          }
        }
      });

      it('builds from scroll alone: the same local gives the same scene, whichever way it was reached', () => {
        const index = CHAPTERS.findIndex((c) => c.id === id);
        const scene = CHAPTER_BUILDERS[CHAPTERS[index].scene](CHAPTERS[index], index);
        const pose = () => {
          scene.object.updateMatrixWorld(true);
          return solids(scene.object).map((b) => b.min.toArray().concat(b.max.toArray()).map((v) => v.toFixed(3)));
        };
        scene.update?.({ progress: 0, local: 0, time: 3 });
        const forward = pose();
        scene.update?.({ progress: 0, local: 2, time: 3 });
        scene.update?.({ progress: 0, local: 0, time: 3 });
        expect(pose()).toEqual(forward);
      });
    });
  }
});
