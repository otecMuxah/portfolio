import { CARS, CHAPTERS, Car, Chapter, Phase } from '../content/life';

export interface JourneyState {
  chapterId: string;
  carId: string | null;
  phase: Phase;
}

export interface ChapterSpan {
  chapter: Chapter;
  start: number;
  end: number;
}

/** Scroll range [start, end) of each chapter, proportional to its scroll weight. */
export function chapterSpans(chapters: Chapter[] = CHAPTERS): ChapterSpan[] {
  const total = chapters.reduce((sum, c) => sum + (c.scrollWeight ?? 1), 0);
  let start = 0;
  return chapters.map((chapter) => {
    const end = start + (chapter.scrollWeight ?? 1) / total;
    const span = { chapter, start, end };
    start = end;
    return span;
  });
}

export function carFor(year: number, cars: Car[] = CARS): Car | null {
  return cars.filter((c) => c.fromYear <= year).at(-1) ?? null;
}

export function journeyAt(progress: number): JourneyState {
  const spans = chapterSpans();
  const p = Math.min(Math.max(progress, 0), 1);
  const { chapter } = spans.find((s) => p < s.end) ?? spans[spans.length - 1];
  return { chapterId: chapter.id, carId: carFor(chapter.year)?.id ?? null, phase: chapter.phase };
}
