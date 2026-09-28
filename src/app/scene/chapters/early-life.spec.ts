import { CHAPTERS, ChapterId } from '../../content/life';
import { sceneContract, stubCanvas } from './scene-contract';

const EARLY: ChapterId[] = ['birth', 'school', 'lyceum', 'university', 'dreamweaver', 'family'];

describe('early-life scenes', () => {
  beforeAll(stubCanvas);

  it('each chapter 1–6 has its own scene, not the placeholder', () => {
    const kinds = EARLY.map((id) => CHAPTERS.find((c) => c.id === id)!.scene);
    expect(kinds).not.toContain('placeholder');
    expect(new Set(kinds).size).toBe(EARLY.length);
  });

  EARLY.forEach(sceneContract);
});
