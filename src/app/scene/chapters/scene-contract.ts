// Test helpers shared by the chapter scene specs; not part of the app bundle.
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CHAPTERS, ChapterId } from '../../content/life';
import { ChapterScene } from '../chapter-scene';
import { withWorkLayer } from '../work/work-layer';
import { CHAPTER_BUILDERS } from '.';

/** Builds a chapter's scene, as the engine would: with its work layer, for a phone when `phone`. */
export function build(id: ChapterId, phone = false): ChapterScene {
  const index = CHAPTERS.findIndex((c) => c.id === id);
  return withWorkLayer(CHAPTER_BUILDERS[CHAPTERS[index].scene](CHAPTERS[index], index, phone), CHAPTERS[index]);
}

/** Builds a chapter's scene and poses it at a local progress. */
export function built(id: ChapterId, local: number, time = 3, phone = false): THREE.Object3D {
  const scene = build(id, phone);
  scene.update?.({ progress: 0, local, time });
  scene.object.updateMatrixWorld(true);
  return scene.object;
}

export function stats(object: THREE.Object3D) {
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
      const perInstance = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      triangles += perInstance * (obj instanceof THREE.InstancedMesh ? obj.count : 1);
    } else if (obj instanceof THREE.Line) drawCalls++;
    else if (obj instanceof THREE.Sprite) {
      drawCalls++;
      triangles += 2;
    }
  });
  return { triangles, drawCalls, particles, lights };
}

/** Every visible vertex, in world space; instanced meshes count each instance. */
export function vertices(object: THREE.Object3D): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const instance = new THREE.Matrix4();
  object.traverseVisible((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      const pos = obj.geometry.getAttribute('position');
      const matrices =
        obj instanceof THREE.InstancedMesh
          ? Array.from({ length: obj.count }, (_, i) => {
              obj.getMatrixAt(i, instance);
              return instance.clone().premultiply(obj.matrixWorld);
            })
          : [obj.matrixWorld];
      for (const m of matrices)
        for (let i = 0; i < pos.count; i++)
          out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m));
    }
  });
  return out;
}

/** World-space boxes of what could stand in the car's way: a box per mesh or line, a point per particle or instance vertex. */
export function solids(object: THREE.Object3D): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];
  object.traverseVisible((obj) => {
    if (obj instanceof THREE.Points || obj instanceof THREE.InstancedMesh) {
      vertices(obj).forEach((p) => boxes.push(new THREE.Box3(p, p.clone())));
    } else if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
      obj.geometry.computeBoundingBox();
      boxes.push(obj.geometry.boundingBox!.clone().applyMatrix4(obj.matrixWorld));
    }
  });
  return boxes;
}

/** Where the car stands at a chapter's midpoint: anchor + CAR_OFFSET (12, 0, 2), a car's width by its length along the road. */
export const CAR = new THREE.Box3(
  new THREE.Vector3(11, -Infinity, -0.5),
  new THREE.Vector3(13, Infinity, 4.5),
);
/** The road and the camera sit front-right of each subject (camera at (18, 7, 16)); that quadrant stays open. */
export const ROAD_SIDE = new THREE.Box3(
  new THREE.Vector3(4, -Infinity, 4),
  new THREE.Vector3(Infinity, Infinity, Infinity),
);

/** jsdom has no 2D canvas; the halo gradient, the border signs and the work layer's lettering only need somewhere to draw. */
export function stubCanvas(): void {
  const draw = () => undefined;
  const ctx = {
    createRadialGradient: () => ({ addColorStop: draw }),
    fillRect: draw,
    strokeRect: draw,
    fillText: draw,
    beginPath: draw,
    lineTo: draw,
    closePath: draw,
    fill: draw,
    // Roughly as wide as bold type: 0.55 em per character.
    measureText(this: { font: string }, text: string) {
      return { width: text.length * parseFloat(this.font.split(' ')[1] ?? '10') * 0.55 };
    },
    font: '700 10px sans-serif',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
}

/** Per chapter, work layer included, framed (local 0.5): what a desktop draws, and the triangles a phone does (#70). */
export const BUDGET = { triangles: 15_000, drawCalls: 40, particles: 1500, phoneTriangles: 6000 } as const;

/** The art-direction contract every chapter scene keeps: budget, plot, road, and state from scroll alone. */
export function sceneContract(id: ChapterId): void {
  describe(id, () => {
    it('stays within the per-chapter budget', () => {
      const { triangles, drawCalls, particles, lights } = stats(built(id, 0.5));
      expect(triangles).toBeLessThanOrEqual(BUDGET.triangles);
      expect(drawCalls).toBeLessThanOrEqual(BUDGET.drawCalls);
      expect(particles).toBeLessThanOrEqual(BUDGET.particles);
      // Real lights cost every fragment in the world; chapters fake theirs with glow and halos.
      expect(lights).toBe(0);
    });

    it('stays within the phone budget when built for a phone', () => {
      const { triangles, drawCalls, particles, lights } = stats(built(id, 0.5, 3, true));
      expect(triangles).toBeLessThanOrEqual(BUDGET.phoneTriangles);
      expect(drawCalls).toBeLessThanOrEqual(BUDGET.drawCalls);
      expect(particles).toBeLessThanOrEqual(BUDGET.particles);
      expect(lights).toBe(0);
    });

    it('keeps clear of the car on the road and the road side and stays inside its 12 m plot, before, during and after the camera', () => {
      for (const local of [-0.5, 0, 0.5, 1, 2]) {
        const scene = built(id, local);
        for (const box of solids(scene)) {
          expect(box.intersectsBox(CAR), `${id} car at local ${local}`).toBe(false);
          expect(box.intersectsBox(ROAD_SIDE), `${id} road side at local ${local}`).toBe(false);
        }
        // The work layer stands behind the plot, on a radius of its own (work-layer.spec.ts).
        const work = scene.getObjectByName('work-layer');
        if (work) work.visible = false;
        for (const v of vertices(scene)) {
          expect(v.y, `${id} at local ${local}`).toBeLessThanOrEqual(22);
          expect(Math.hypot(v.x, v.z), `${id} at local ${local}`).toBeLessThanOrEqual(12);
        }
      }
    });

    it('builds from scroll alone: the same local gives the same scene, whichever way it was reached', () => {
      const scene = build(id);
      const pose = () => {
        scene.object.updateMatrixWorld(true);
        return solids(scene.object).map((b) =>
          b.min
            .toArray()
            .concat(b.max.toArray())
            .map((v) => v.toFixed(3)),
        );
      };
      scene.update?.({ progress: 0, local: 0, time: 3 });
      const forward = pose();
      scene.update?.({ progress: 0, local: 2, time: 3 });
      scene.update?.({ progress: 0, local: 0, time: 3 });
      expect(pose()).toEqual(forward);
    });
  });
}
