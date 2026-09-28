import * as THREE from 'three';
import { chapterSpans } from '../journey/journey';

const FIRST = chapterSpans().find((s) => s.chapter.phase === 'rebuild')!;

/** The stretch of the first rebuild chapter (its local progress) over which the F30 assembles out of the war's light. */
export const F30_ASSEMBLY = { start: 0.02, end: 0.3 } as const;

/** How far the F30 has assembled at journey progress: 0 until the rebuild starts, 1 once it is whole. Pure. */
export function f30Assembled(progress: number): number {
  const local = (progress - FIRST.start) / (FIRST.end - FIRST.start);
  return Math.min(Math.max((local - F30_ASSEMBLY.start) / (F30_ASSEMBLY.end - F30_ASSEMBLY.start), 0), 1);
}

/** Chassis up, lights last: the headlights coming on are the light passing into the car. Unnamed parts go with the grille. */
const RANK = ['wheel', 'body', 'grille', 'cabin', 'roof', 'taillight', 'headlight'];
const rank = (part: THREE.Object3D) => {
  const i = RANK.indexOf(part.name);
  return i < 0 ? RANK.indexOf('grille') : i;
};

/** A car's parts in the order the rebuild assembles them; ties keep the order they were built in. */
export function assemblyOrder(car: THREE.Object3D): THREE.Object3D[] {
  return car.children
    .map((part, i) => ({ part, i }))
    .sort((a, b) => rank(a.part) - rank(b.part) || a.i - b.i)
    .map(({ part }) => part);
}

/** Share of the assembly each part spends flying from the light to its place. */
const FLIGHT = 0.3;

/**
 * How far part `i` of `n` (in assemblyOrder) has flown home at assembly `k`: 0 until it leaves the light, 1 once it is
 * in place. Each leaves after the one before and slows as it lands. Pure, so scrolling back takes the car apart exactly.
 */
export function partFlight(k: number, i: number, n: number): number {
  const start = n > 1 ? (i / (n - 1)) * (1 - FLIGHT) : 0;
  const f = Math.min(Math.max((k - start) / FLIGHT, 0), 1);
  return 1 - (1 - f) ** 3;
}
