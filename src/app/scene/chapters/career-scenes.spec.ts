import { CHAPTERS, ChapterId } from '../../content/life';
import { sceneContract, stubCanvas } from './scene-contract';

const CAREER: ChapterId[] = ['first-code', 'kharkiv-career', 'krakow', 'back-home'];

describe('career scenes', () => {
  beforeAll(stubCanvas);

  it('each chapter 7–10 has its own scene, not the placeholder', () => {
    const kinds = CAREER.map((id) => CHAPTERS.find((c) => c.id === id)!.scene);
    expect(kinds).not.toContain('placeholder');
    expect(new Set(kinds).size).toBe(CAREER.length);
  });

  CAREER.forEach(sceneContract);
});
