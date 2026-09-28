import * as THREE from 'three';
import { CHAPTERS } from '../../content/life';
import { SPLIT, driveProgress } from '../escape';
import { build, built, sceneContract, stubCanvas } from './scene-contract';

describe('war scene', () => {
  beforeAll(stubCanvas);

  it('has its own scene, not the placeholder', () => {
    expect(CHAPTERS.find((c) => c.id === 'war')!.scene).toBe('war');
  });

  it('is dark until the city breaks, then leaves one light that keeps its colour through the drain', () => {
    const shown = (local: number) => {
      const lit: THREE.Material[] = [];
      built('war', local).traverseVisible((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) lit.push(m);
      });
      return lit;
    };
    expect(shown(0)).toEqual([]);
    const end = shown(1);
    expect(end.length).toBeGreaterThan(0);
    for (const m of end) {
      expect(m.userData['ungraded']).toBe(true);
      expect((m as THREE.MeshStandardMaterial).fog).toBe(false);
    }
  });

  it('gives its light up to the F30 once the drive out has split it into headlights, and takes it back in reverse', () => {
    const scene = build('war');
    const shown = (progress: number) => {
      scene.update?.({ progress, local: 1, time: 3 });
      let count = 0;
      scene.object.traverseVisible((o) => (count += (o as THREE.Mesh).material ? 1 : 0));
      return count;
    };
    const before = shown(driveProgress(0));
    expect(before).toBeGreaterThan(0);
    expect(shown(driveProgress(SPLIT))).toBe(0);
    expect(shown(driveProgress(0.5))).toBe(0);
    expect(shown(driveProgress(0))).toBe(before);
  });

  sceneContract('war');
});
