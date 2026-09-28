import { CHAPTERS, CHAPTER_TEXT } from '../content/life';
import { carFor, chapterSpans, journeyAt, riderAt, riderFor, yearAt } from './journey';

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
];

const visitedInOrder = () => {
  const visited = Array.from({ length: 10001 }, (_, i) => journeyAt(i / 10000));
  return visited.filter((s, i) => s.chapterId !== visited[i - 1]?.chapterId);
};

describe('journeyAt', () => {
  it('starts the journey at birth in 1981, before any car', () => {
    expect(journeyAt(0)).toEqual({ chapterId: 'birth', carId: null, riderId: 'crawl', phase: 'build' });
  });

  it('ends the journey at IATA', () => {
    expect(journeyAt(1)).toMatchObject({ chapterId: 'iata', phase: 'rebuild' });
  });

  it('clamps scroll overshoot to the first and last chapter', () => {
    expect(journeyAt(-0.2).chapterId).toBe('birth');
    expect(journeyAt(1.3).chapterId).toBe('iata');
  });

  it('visits all 14 chapters exactly once, in order, across the scroll', () => {
    expect(visitedInOrder().map((s) => s.chapterId)).toEqual(ORDER);
  });

  it('builds through chapters 1–11, shatters in 12, and rebuilds in 13–14', () => {
    expect(visitedInOrder().map((s) => s.phase)).toEqual([
      ...Array(11).fill('build'),
      'shatter',
      'rebuild',
      'rebuild',
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
      'kharkiv-career': 'forester',
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
    [2015, 'forester'],
    [2016, 'f30'],
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

  it('holds IATA, the last chapter, at its own year to the end of the scroll', () => {
    expect(yearAt(spans, at('iata', 0.99))).toBe(2024);
    expect(yearAt(spans, 1)).toBe(2024);
    expect(journeyAt(1).carId).toBe('f30');
  });

  it('swaps cars mid-chapter as the scrolled year passes each start year', () => {
    expect(journeyAt(at('dreamweaver', 0.49)).carId).toBeNull();
    expect(journeyAt(at('dreamweaver', 0.51)).carId).toBe('golf2');
    expect(journeyAt(at('dreamweaver', 0.68)).carId).toBe('mazda323f');
    expect(journeyAt(at('family', 0.01)).carId).toBe('mazda3');
    expect(journeyAt(at('family', 0.99)).carId).toBe('mazda3');
    expect(journeyAt(at('rally', 0)).carId).toBe('forester');
    expect(journeyAt(at('rally', 0.99)).carId).toBe('forester');
    expect(journeyAt(at('first-code', 0.99)).carId).toBe('forester');
    expect(journeyAt(at('kharkiv-career', 0.16)).carId).toBe('forester');
    expect(journeyAt(at('kharkiv-career', 0.18)).carId).toBe('f30');
  });

  it('meets every car once, in ownership order, and reverses exactly when scrolling back', () => {
    const distinct = (ids: (string | null)[]) => ids.filter((id, i) => i === 0 || id !== ids[i - 1]);
    const forward = distinct(Array.from({ length: 10001 }, (_, i) => journeyAt(i / 10000).carId));
    const backward = distinct(Array.from({ length: 10001 }, (_, i) => journeyAt(1 - i / 10000).carId));
    expect(forward).toEqual([null, 'golf2', 'mazda323f', 'mazda3', 'forester', 'f30']);
    expect(backward).toEqual([...forward].reverse());
  });
});

describe('the person on the road before the first car', () => {
  const spans = chapterSpans();
  const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
  const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

  it.each([
    [1981, 'crawl'],
    [1986.9, 'crawl'],
    [1987, 'walk'],
    [1993.9, 'walk'],
    [1994, 'run'],
    [1998, 'bike'],
    [2002.9, 'bike'],
    [2003, null],
    [2024, null],
  ])('in %d is %s', (year, riderId) => {
    expect(riderFor(year).riderId).toBe(riderId);
  });

  it('crawls at birth, walks to school, runs at the lyceum and cycles through university until the Golf', () => {
    expect(riderAt(0).riderId).toBe('crawl');
    expect(riderAt(at('birth', 0.5)).riderId).toBe('crawl');
    expect(riderAt(at('school', 0.5)).riderId).toBe('walk');
    expect(riderAt(at('lyceum', 0.5)).riderId).toBe('run');
    expect(riderAt(at('university', 0.5)).riderId).toBe('bike');
    expect(riderAt(at('dreamweaver', 0.49)).riderId).toBe('bike');
    expect(riderAt(at('dreamweaver', 0.51)).riderId).toBeNull();
    expect(journeyAt(at('dreamweaver', 0.51))).toMatchObject({ carId: 'golf2', riderId: null });
    expect(riderAt(1).riderId).toBeNull();
  });

  it('grows continuously, half-way through each change in its year, with no jump anywhere', () => {
    expect(riderFor(1981).growth).toBe(0);
    expect(riderFor(1987).growth).toBeCloseTo(0.5);
    expect(riderFor(1990).growth).toBe(1);
    expect(riderFor(1994).growth).toBeCloseTo(1.5);
    expect(riderFor(1998).growth).toBeCloseTo(2.5);
    expect(riderFor(2000).growth).toBe(3);
    let last = riderAt(0).growth;
    for (let i = 1; i <= 3000; i++) {
      const { growth } = riderAt((i / 3000) * at('dreamweaver', 0.49));
      expect(growth - last).toBeGreaterThanOrEqual(0);
      expect(growth - last).toBeLessThan(0.05);
      last = growth;
    }
  });

  it('gets off the bike over the last stretch before the first car', () => {
    expect(riderFor(2002).handover).toBe(0);
    expect(riderFor(2002.65).handover).toBeCloseTo(0.5);
    expect(riderFor(2002.999).handover).toBeCloseTo(1, 2);
  });

  it('meets each stage once, in order, and reverses exactly when scrolling back', () => {
    const distinct = (ids: (string | null)[]) => ids.filter((id, i) => i === 0 || id !== ids[i - 1]);
    const progress = Array.from({ length: 10001 }, (_, i) => i / 10000);
    const forward = progress.map((p) => ({ ...riderAt(p) }));
    const backward = [...progress].reverse().map((p) => ({ ...riderAt(p) }));
    expect(distinct(forward.map((r) => r.riderId))).toEqual(['crawl', 'walk', 'run', 'bike', null]);
    expect(backward.reverse()).toEqual(forward);
  });

  it('writes into the state it is given rather than allocating one', () => {
    const out = riderAt(0);
    expect(riderAt(at('school', 0.5), out)).toBe(out);
    expect(out.riderId).toBe('walk');
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
  it('dates every chapter', () => {
    expect(CHAPTERS.filter((c) => c.year === undefined).map((c) => c.id)).toEqual([]);
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
