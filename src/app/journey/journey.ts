import { CARS, CHAPTERS, Car, Chapter, ChapterId, Phase } from '../content/life';

export interface JourneyState {
  chapterId: ChapterId;
  carId: string | null;
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

export function carFor(year: number, cars: Car[] = CARS): Car | null {
  return cars.filter((c) => c.fromYear <= year).at(-1) ?? null;
}

const SPANS = chapterSpans();

export function journeyAt(progress: number): JourneyState {
  const { chapter } = spanAt(SPANS, progress);
  const carId = chapter.year === undefined ? null : (carFor(chapter.year)?.id ?? null);
  return { chapterId: chapter.id, carId, phase: chapter.phase };
}
