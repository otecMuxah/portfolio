import { seeded, smoothstep } from './kit';

/** Share of the gather each particle spends in flight; the rest of the range staggers their departures. */
export const FLIGHT = 0.35;

/** A departure time per particle in [0, 1 - FLIGHT], seeded, so the cloud gathers as a wave rather than all at once. */
export function gatherDelays(count: number, seed: number): Float32Array {
  const random = seeded(seed);
  const delays = new Float32Array(count);
  for (let i = 0; i < count; i++) delays[i] = random() * (1 - FLIGHT);
  return delays;
}

/**
 * Writes into `out` each particle's position `t` (0..1) of the way from `from` to `to`, each leaving at its own delay.
 * Pure and allocation-free: the same `t` always gives the same positions, so scrolling back scatters them again.
 */
export function gather(out: Float32Array, from: Float32Array, to: Float32Array, delays: Float32Array, t: number): void {
  for (let i = 0; i < delays.length; i++) {
    const p = smoothstep(delays[i], delays[i] + FLIGHT, t);
    for (let k = i * 3; k < i * 3 + 3; k++) out[k] = from[k] + (to[k] - from[k]) * p;
  }
}
