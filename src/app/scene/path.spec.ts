import * as THREE from 'three';
import { chapterSpans, journeyAt } from '../journey/journey';
import { driveAt } from './escape';
import { stillAt } from './path';
import { SHAKE_STOP, SHATTERED, shakeAt } from './shatter';

describe('stillAt', () => {
  const spans = chapterSpans();

  it('holds every chapter at one progress inside it, whatever part of it is scrolled', () => {
    for (const { chapter, start, end } of spans) {
      const still = stillAt(spans, start);
      for (const local of [0, 0.3, 0.7, 0.999]) expect(stillAt(spans, start + local * (end - start))).toBe(still);
      expect(journeyAt(still).chapterId).toBe(chapter.id);
    }
  });

  it('holds the war after its world has broken, with no shake, before the drive out', () => {
    const war = spans.find((s) => s.chapter.phase === 'shatter')!;
    const still = stillAt(spans, war.start);
    const local = (still - war.start) / (war.end - war.start);
    expect(local).toBeGreaterThan(SHATTERED);
    expect(local).toBeGreaterThan(SHAKE_STOP);
    const shake = new THREE.Vector3();
    expect(Math.abs(shakeAt(local, shake))).toBe(0);
    expect(shake.length()).toBe(0);
    expect(driveAt(still)).toBe(0);
  });
});
