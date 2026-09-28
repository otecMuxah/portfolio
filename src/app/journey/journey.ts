import { CARS, CHAPTERS, Car, CarId, Chapter, ChapterId, Phase } from '../content/life';

export interface JourneyState {
  chapterId: ChapterId;
  carId: CarId | null;
  phase: Phase;
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

const SPANS = chapterSpans();

export function journeyAt(progress: number): JourneyState {
  const { chapter } = spanAt(SPANS, progress);
  const year = yearAt(SPANS, progress);
  const carId = year === undefined ? null : (carFor(year)?.id ?? null);
  return { chapterId: chapter.id, carId, phase: chapter.phase };
}
