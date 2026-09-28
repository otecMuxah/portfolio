import { ChapterSpan } from '../journey/journey';

/** Where the war sits on the journey, and where the ambient is fully back after it. */
export interface WarSpan {
  start: number;
  end: number;
  /** Progress at which the ambient has fully returned: half way into the next chapter. */
  back: number;
}

/** Share of the war chapter over which the ambient ducks out. */
export const DUCK = 0.2;
/** The rumble rises over [0, RISE), holds, and has fallen to nothing by SILENCE_FROM. */
export const RISE = 0.25;
export const FALL_FROM = 0.45;
export const SILENCE_FROM = 0.7;

/** The shatter chapter's span, derived from the chapter spans so scroll weights can change. */
export function warSpan(spans: ChapterSpan[]): WarSpan {
  const war = spans.find((s) => s.chapter.phase === 'shatter')!;
  const next = spans[war.index + 1];
  return { start: war.start, end: war.end, back: next ? (next.start + next.end) / 2 : war.end };
}

const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

/** Ambient pad level 0..1: full, ducks out entering the war, silent through it, returns after. */
export function ambientLevel(progress: number, war: WarSpan): number {
  if (progress < war.start) return 1;
  if (progress < war.end) return 1 - smooth((progress - war.start) / (war.end - war.start) / DUCK);
  if (progress < war.back) return smooth((progress - war.end) / (war.back - war.end));
  return 1;
}

/** Rumble level 0..1: only inside the war, rising, holding, then falling to silence. */
export function rumbleLevel(progress: number, war: WarSpan): number {
  if (progress < war.start || progress >= war.end) return 0;
  const local = (progress - war.start) / (war.end - war.start);
  if (local < RISE) return smooth(local / RISE);
  if (local < FALL_FROM) return 1;
  return 1 - smooth((local - FALL_FROM) / (SILENCE_FROM - FALL_FROM));
}
