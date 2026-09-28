import { CHAPTERS } from '../content/life';
import { carFor, chapterSpans, journeyAt } from './journey';

describe('journeyAt', () => {
  it('starts the journey at birth in 1981, before any car', () => {
    expect(journeyAt(0)).toEqual({ chapterId: 'birth', carId: null, phase: 'build' });
  });

  it('is in the 2012 first-code chapter mid-journey, riding the Forester', () => {
    expect(journeyAt(0.7)).toEqual({ chapterId: 'first-code', carId: 'forester', phase: 'build' });
  });

  it('ends the journey today at IATA in the F30, in the rebuild phase', () => {
    expect(journeyAt(1)).toEqual({ chapterId: 'iata', carId: 'f30', phase: 'rebuild' });
  });

  it('clamps scroll overshoot to the first and last chapter', () => {
    expect(journeyAt(-0.2).chapterId).toBe('birth');
    expect(journeyAt(1.3).chapterId).toBe('iata');
  });

  it('visits every chapter exactly once, in order, across the scroll', () => {
    const visited = Array.from({ length: 1001 }, (_, i) => journeyAt(i / 1000).chapterId);
    const distinct = visited.filter((id, i) => id !== visited[i - 1]);
    expect(distinct).toEqual(['birth', 'family', 'married', 'first-code', 'iata']);
  });
});

describe('the car carrying the camera', () => {
  it.each([
    [2002, null],
    [2003, 'golf2'],
    [2004, 'mazda323f'],
    [2006, 'mazda3'],
    [2008, 'forester'],
    [2012, 'forester'],
    [2013, 'f30'],
    [2024, 'f30'],
  ])('in %i is %s', (year, carId) => {
    expect(carFor(year)?.id ?? null).toBe(carId);
  });

  it('is the car of the chapter year at every scroll position', () => {
    for (const { chapter, start, end } of chapterSpans()) {
      expect(journeyAt((start + end) / 2).carId).toBe(carFor(chapter.year)?.id ?? null);
    }
  });
});

describe('life content', () => {
  it('lists chapters in chronological order', () => {
    const years = CHAPTERS.map((c) => c.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });
});
