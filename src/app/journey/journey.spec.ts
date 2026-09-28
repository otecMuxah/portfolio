import { CHAPTERS, CHAPTER_TEXT } from '../content/life';
import { chapterSpans, journeyAt } from './journey';

const ORDER = [
  'birth',
  'school',
  'lyceum',
  'university',
  'dreamweaver',
  'family',
  'first-code',
  'kharkiv-career',
  'krakow',
  'back-home',
  'war',
  'ciklum',
  'iata',
  'garage',
];

const visitedInOrder = () => {
  const visited = Array.from({ length: 10001 }, (_, i) => journeyAt(i / 10000));
  return visited.filter((s, i) => s.chapterId !== visited[i - 1]?.chapterId);
};

describe('journeyAt', () => {
  it('starts the journey at birth in 1981, before any car', () => {
    expect(journeyAt(0)).toEqual({ chapterId: 'birth', carId: null, phase: 'build' });
  });

  it('ends the journey in the garage', () => {
    expect(journeyAt(1)).toMatchObject({ chapterId: 'garage', phase: 'garage' });
  });

  it('clamps scroll overshoot to the first and last chapter', () => {
    expect(journeyAt(-0.2).chapterId).toBe('birth');
    expect(journeyAt(1.3).chapterId).toBe('garage');
  });

  it('visits all 13 chapters and then the garage exactly once, in order, across the scroll', () => {
    expect(visitedInOrder().map((s) => s.chapterId)).toEqual(ORDER);
  });

  it('builds through chapters 1–10, shatters in 11, rebuilds in 12–13 and ends in the garage', () => {
    expect(visitedInOrder().map((s) => s.phase)).toEqual([
      ...Array(10).fill('build'),
      'shatter',
      'rebuild',
      'rebuild',
      'garage',
    ]);
  });

  it('rides the car owned in each dated chapter year', () => {
    const cars = Object.fromEntries(visitedInOrder().map((s) => [s.chapterId, s.carId]));
    expect(cars).toMatchObject({
      birth: null,
      university: null,
      dreamweaver: null,
      family: 'mazda3',
      'first-code': 'forester',
      'kharkiv-career': 'f30',
      ciklum: 'f30',
      iata: 'f30',
    });
  });
});

describe('chapter spans', () => {
  it('are strictly ordered, contiguous and non-overlapping, covering the whole scroll', () => {
    const spans = chapterSpans();
    expect(spans[0].start).toBe(0);
    expect(spans.at(-1)!.end).toBeCloseTo(1);
    spans.forEach((span, i) => {
      expect(span.end).toBeGreaterThan(span.start);
      if (i > 0) expect(span.start).toBe(spans[i - 1].end);
    });
  });
});

describe('life content', () => {
  it('lists dated chapters in chronological order', () => {
    const years = CHAPTERS.flatMap((c) => (c.year === undefined ? [] : [c.year]));
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('flags only the war chapter as placeholder text, awaiting Mykhailo’s own words', () => {
    const flagged = CHAPTERS.filter((c) => CHAPTER_TEXT.en[c.id].placeholder).map((c) => c.id);
    expect(flagged).toEqual(['war']);
  });

  it('carries no phone number', () => {
    const text = JSON.stringify(CHAPTER_TEXT);
    expect(text).not.toMatch(/\+?\d[\d ()-]{7,}\d/);
  });
});
