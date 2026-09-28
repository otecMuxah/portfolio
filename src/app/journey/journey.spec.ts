import { CHAPTERS, CHAPTER_TEXT } from '../content/life';
import { carFor, chapterSpans, journeyAt, yearAt } from './journey';

const ORDER = [
  'birth',
  'school',
  'lyceum',
  'university',
  'dreamweaver',
  'family',
  'rally',
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

  it('visits all 14 chapters and then the garage exactly once, in order, across the scroll', () => {
    expect(visitedInOrder().map((s) => s.chapterId)).toEqual(ORDER);
  });

  it('builds through chapters 1–11, shatters in 12, rebuilds in 13–14 and ends in the garage', () => {
    expect(visitedInOrder().map((s) => s.phase)).toEqual([
      ...Array(11).fill('build'),
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
      school: null,
      lyceum: null,
      university: null,
      dreamweaver: null,
      family: 'mazda3',
      rally: 'forester',
      'first-code': 'forester',
      'kharkiv-career': 'f30',
      ciklum: 'f30',
      iata: 'f30',
    });
  });
});

describe('the car carrying the camera', () => {
  const spans = chapterSpans();
  const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
  /** Progress a fraction of the way through a chapter's span. */
  const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

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

  it('reads the scrolled year from the chapter start to the next dated chapter', () => {
    expect(yearAt(spans, at('dreamweaver', 0))).toBe(2000);
    expect(yearAt(spans, at('dreamweaver', 0.5))).toBeCloseTo(2003);
    expect(yearAt(spans, at('family', 0))).toBeCloseTo(2006);
    expect(yearAt(spans, at('family', 0.5))).toBeCloseTo(2007);
    expect(yearAt(spans, at('back-home', 0.5))).toBe(2022);
  });

  it('holds the last dated chapter at its own year when only undated chapters follow', () => {
    expect(yearAt(spans, at('iata', 0.99))).toBe(2024);
  });

  it('has no year and no car in the undated garage', () => {
    expect(yearAt(spans, at('garage', 0.5))).toBeUndefined();
    expect(journeyAt(at('garage', 0.5)).carId).toBeNull();
  });

  it('swaps cars mid-chapter as the scrolled year passes each start year', () => {
    expect(journeyAt(at('dreamweaver', 0.49)).carId).toBeNull();
    expect(journeyAt(at('dreamweaver', 0.51)).carId).toBe('golf2');
    expect(journeyAt(at('dreamweaver', 0.68)).carId).toBe('mazda323f');
    expect(journeyAt(at('family', 0.01)).carId).toBe('mazda3');
    expect(journeyAt(at('family', 0.99)).carId).toBe('mazda3');
    expect(journeyAt(at('rally', 0)).carId).toBe('forester');
    expect(journeyAt(at('rally', 0.99)).carId).toBe('forester');
    expect(journeyAt(at('first-code', 0.32)).carId).toBe('forester');
    expect(journeyAt(at('first-code', 0.34)).carId).toBe('f30');
  });

  it('meets every car once, in ownership order, and reverses exactly when scrolling back', () => {
    const distinct = (ids: (string | null)[]) => ids.filter((id, i) => i === 0 || id !== ids[i - 1]);
    const forward = distinct(Array.from({ length: 10001 }, (_, i) => journeyAt(i / 10000).carId));
    const backward = distinct(Array.from({ length: 10001 }, (_, i) => journeyAt(1 - i / 10000).carId));
    expect(forward).toEqual([null, 'golf2', 'mazda323f', 'mazda3', 'forester', 'f30', null]);
    expect(backward).toEqual([...forward].reverse());
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
  it('dates every chapter but the garage', () => {
    expect(CHAPTERS.filter((c) => c.year === undefined).map((c) => c.id)).toEqual(['garage']);
  });

  it('lists dated chapters in chronological order', () => {
    const years = CHAPTERS.flatMap((c) => (c.year === undefined ? [] : [c.year]));
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('flags no chapter as placeholder text', () => {
    const flagged = CHAPTERS.filter((c) => CHAPTER_TEXT.en[c.id].placeholder).map((c) => c.id);
    expect(flagged).toEqual([]);
  });

  it('carries no phone number', () => {
    const text = JSON.stringify(CHAPTER_TEXT);
    expect(text).not.toMatch(/\+?\d[\d ()-]{7,}\d/);
  });
});
