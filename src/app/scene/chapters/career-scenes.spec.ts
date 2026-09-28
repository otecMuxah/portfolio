import * as THREE from 'three';
import { CHAPTERS, CHAPTER_TEXT, ChapterId } from '../../content/life';
import { built, sceneContract, stubCanvas } from './scene-contract';

const CAREER: ChapterId[] = ['first-code', 'kharkiv-career', 'krakow', 'back-home'];

/** The skill ring's visible tokens: the one instanced mesh in the Kharkiv career scene. */
function ring(local: number): THREE.InstancedMesh {
  let found: THREE.InstancedMesh | undefined;
  built('kharkiv-career', local).traverse((o) => {
    if (o instanceof THREE.InstancedMesh) found = o;
  });
  return found!;
}

describe('career scenes', () => {
  beforeAll(stubCanvas);

  it('each chapter 7–10 has its own scene, not the placeholder', () => {
    const kinds = CAREER.map((id) => CHAPTERS.find((c) => c.id === id)!.scene);
    expect(kinds).not.toContain('placeholder');
    expect(new Set(kinds).size).toBe(CAREER.length);
  });

  it('the Kharkiv career ring has one token per skill on the card, adding them as the chapter plays', () => {
    const skills = CHAPTER_TEXT.en['kharkiv-career'].skills!;
    expect(ring(0).count).toBe(0);
    expect(ring(0.5).count).toBeGreaterThan(0);
    expect(ring(0.5).count).toBeLessThan(skills.length);
    expect(ring(1).count).toBe(skills.length);
  });

  CAREER.forEach(sceneContract);
});
