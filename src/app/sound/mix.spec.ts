import { CHAPTERS } from '../content/life';
import { chapterSpans } from '../journey/journey';
import { FALL_FROM, RISE, SILENCE_FROM, ambientLevel, rumbleLevel, warSpan } from './mix';

const spans = chapterSpans();
const war = warSpan(spans);
const at = (local: number) => war.start + (war.end - war.start) * local;

describe('warSpan', () => {
  it('is the shatter chapter, with the ambient back half way into the next chapter', () => {
    const index = CHAPTERS.findIndex((c) => c.phase === 'shatter');
    expect(war.start).toBe(spans[index].start);
    expect(war.end).toBe(spans[index].end);
    expect(war.back).toBe((spans[index + 1].start + spans[index + 1].end) / 2);
  });

  it('follows the war chapter when its scroll weight grows', () => {
    const heavier = CHAPTERS.map((c) => (c.phase === 'shatter' ? { ...c, scrollWeight: 3 } : c));
    const grown = warSpan(chapterSpans(heavier));
    expect(grown.end - grown.start).toBeGreaterThan(war.end - war.start);
  });
});

describe('ambient and rumble levels', () => {
  it('plays the ambient alone before the war and after it has returned', () => {
    for (const p of [0, war.start / 2, war.start - 1e-9, war.back, (war.back + 1) / 2, 1]) {
      expect(ambientLevel(p, war)).toBe(1);
      expect(rumbleLevel(p, war)).toBe(0);
    }
  });

  it('ducks the ambient out as the rumble rises entering the war', () => {
    expect(ambientLevel(at(0.1), war)).toBeCloseTo(0.5);
    expect(ambientLevel(at(0.2), war)).toBe(0);
    expect(rumbleLevel(at(0), war)).toBe(0);
    expect(rumbleLevel(at(RISE / 2), war)).toBeCloseTo(0.5);
    expect(rumbleLevel(at(RISE), war)).toBe(1);
    expect(rumbleLevel(at((RISE + FALL_FROM) / 2), war)).toBe(1);
  });

  it('falls to silence and holds it for the last part of the war', () => {
    expect(rumbleLevel(at((FALL_FROM + SILENCE_FROM) / 2), war)).toBeCloseTo(0.5);
    for (const local of [SILENCE_FROM, 0.8, 0.9, 0.999]) {
      expect(rumbleLevel(at(local), war)).toBe(0);
      expect(ambientLevel(at(local), war)).toBe(0);
    }
  });

  it('brings the ambient back gently after the war', () => {
    const mid = (war.end + war.back) / 2;
    expect(ambientLevel(war.end, war)).toBe(0);
    expect(ambientLevel(mid, war)).toBeCloseTo(0.5);
    expect(rumbleLevel(mid, war)).toBe(0);
  });

  it('moves smoothly: no step between neighbouring scroll positions', () => {
    const steps = 20000;
    for (let i = 1; i <= steps; i++) {
      const [a, b] = [(i - 1) / steps, i / steps];
      expect(Math.abs(ambientLevel(b, war) - ambientLevel(a, war))).toBeLessThan(0.01);
      expect(Math.abs(rumbleLevel(b, war) - rumbleLevel(a, war))).toBeLessThan(0.01);
    }
  });

  it('depends on progress only, so scrolling back retraces the same levels', () => {
    const points = Array.from({ length: 1001 }, (_, i) => i / 1000);
    const forward = points.map((p) => [ambientLevel(p, war), rumbleLevel(p, war)]);
    const backward = [...points].reverse().map((p) => [ambientLevel(p, war), rumbleLevel(p, war)]);
    expect(backward.reverse()).toEqual(forward);
  });
});
