import { CARS, CHAPTERS, Car, CarId, Chapter, ChapterId, Phase } from '../content/life';

/** How he travels the road himself before the first car. */
export type RiderId = 'crawl' | 'walk' | 'run' | 'bike';

export interface JourneyState {
  chapterId: ChapterId;
  carId: CarId | null;
  riderId: RiderId | null;
  phase: Phase;
}

export interface RiderState {
  /** The stage he is in, or null once a car carries the camera. */
  riderId: RiderId | null;
  /** Growth through the stages, continuous: 0 crawl, 1 walk, 2 run, 3 bike. Each change blends across its year. */
  growth: number;
  /** Getting off the bike and standing at the first car's driver's door, 0..1 over the last stretch before it. */
  handover: number;
  /** The first car pulling up beside him, 0..1 just after its year starts: scroll-driven, not clock-timed. */
  arrival: number;
  /** Him getting in, 0..1 once the car has landed; he is gone at 1. */
  boarding: number;
}

export interface ChapterSpan {
  chapter: Chapter;
  index: number;
  start: number;
  end: number;
}

/** Scroll range [start, end) of each chapter, proportional to its scroll weight. */
export function chapterSpans(chapters: Chapter[] = CHAPTERS): ChapterSpan[] {
  const total = chapters.reduce((sum, c) => sum + (c.scrollWeight ?? 1), 0);
  let start = 0;
  return chapters.map((chapter, index) => {
    const end = start + (chapter.scrollWeight ?? 1) / total;
    const span = { chapter, index, start, end };
    start = end;
    return span;
  });
}

/** The span containing progress, clamped to the first and last chapter. */
export function spanAt(spans: ChapterSpan[], progress: number): ChapterSpan {
  return spans.find((s) => progress < s.end) ?? spans[spans.length - 1];
}

/** The most recent car whose start year is at or before `year`, or null before the first car. */
export function carFor(year: number, cars: Car[] = CARS): Car | null {
  let owned: Car | null = null;
  for (const car of cars) if (car.fromYear <= year) owned = car;
  return owned;
}

/**
 * The year the scroll has reached: runs linearly from the chapter's start year to the next dated
 * chapter's start year across the chapter's span. Undated chapters have no year.
 */
export function yearAt(spans: ChapterSpan[], progress: number): number | undefined {
  const { chapter, index, start, end } = spanAt(spans, progress);
  if (chapter.year === undefined) return undefined;
  let next = chapter.year;
  for (let i = index + 1; i < spans.length; i++) {
    const year = spans[i].chapter.year;
    if (year !== undefined) {
      next = year;
      break;
    }
  }
  const local = Math.min(Math.max((progress - start) / (end - start), 0), 1);
  return chapter.year + (next - chapter.year) * local;
}

/** Each stage starts in its chapter's year: he crawls from birth, walks to school, runs at the lyceum, cycles from university. */
const RIDER_STAGES: [RiderId, ChapterId][] = [
  ['crawl', 'birth'],
  ['walk', 'school'],
  ['run', 'lyceum'],
  ['bike', 'university'],
];
const STAGE_YEARS = RIDER_STAGES.map(([, id]) => CHAPTERS.find((c) => c.id === id)!.year!);
/** Years each change of stage takes, centred on the year it happens. */
const STAGE_BLEND = 1.2;
/** Years before the first car in which he gets off the bike and waits for it. */
const HANDOVER = 0.7;
/** Years after the first car's start that it takes to pull up, and then for him to get in. */
const ARRIVAL = 0.2;
const BOARDING = 0.25;

/**
 * How he travels in `year`, until the first car takes over. The stage is the latest one whose year has come, as with
 * cars; growth runs continuously across each change, half-way at its year. Pure and allocation-free: writes into `out`.
 */
export function riderFor(
  year: number | undefined,
  out: RiderState = { riderId: null, growth: 0, handover: 0, arrival: 0, boarding: 0 },
): RiderState {
  const first = CARS[0].fromYear;
  out.riderId = null;
  out.growth = RIDER_STAGES.length - 1;
  out.handover = 1;
  out.arrival = year === undefined ? 1 : clamp01((year - first) / ARRIVAL);
  out.boarding = year === undefined ? 1 : clamp01((year - first - ARRIVAL) / BOARDING);
  if (year === undefined || carFor(year)) return out;
  out.growth = 0;
  for (let i = 0; i < RIDER_STAGES.length; i++) {
    if (STAGE_YEARS[i] <= year) out.riderId = RIDER_STAGES[i][0];
    if (i > 0) out.growth += smoothstep(STAGE_YEARS[i] - STAGE_BLEND / 2, STAGE_YEARS[i] + STAGE_BLEND / 2, year);
  }
  out.handover = clamp01((year - (first - HANDOVER)) / HANDOVER);
  return out;
}

const SPANS = chapterSpans();

/** How he travels at a scroll position (see riderFor). */
export function riderAt(progress: number, out?: RiderState): RiderState {
  return riderFor(yearAt(SPANS, progress), out);
}

export function journeyAt(progress: number): JourneyState {
  const { chapter } = spanAt(SPANS, progress);
  const year = yearAt(SPANS, progress);
  const carId = year === undefined ? null : (carFor(year)?.id ?? null);
  return { chapterId: chapter.id, carId, riderId: riderFor(year).riderId, phase: chapter.phase };
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}
