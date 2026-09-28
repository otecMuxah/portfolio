import * as THREE from 'three';
import { CHAPTERS } from '../../content/life';
import { built, sceneContract, stubCanvas } from './scene-contract';

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

  sceneContract('war');
});
