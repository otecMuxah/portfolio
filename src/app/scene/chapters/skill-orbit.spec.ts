import * as THREE from 'three';
import {
  RING_MAX_RADIUS,
  RING_MIN_RADIUS,
  ringRadius,
  skillOrbit,
  tokenScale,
  tokensShown,
} from './skill-orbit';

const steps = (from: number, to: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe('skill orbit', () => {
  it('shows no tokens before the chapter starts and every token once it ends', () => {
    expect(tokensShown(-0.5, 7)).toBe(0);
    expect(tokensShown(0, 7)).toBe(0);
    expect(tokensShown(1, 7)).toBe(7);
    expect(tokensShown(2, 7)).toBe(7);
  });

  it('adds tokens one by one as local progress goes from 0 to 1, never removing one', () => {
    const counts = steps(0, 1, 70).map((l) => tokensShown(l, 7));
    counts.slice(1).forEach((c, i) => {
      expect(c).toBeGreaterThanOrEqual(counts[i]);
      expect(c - counts[i]).toBeLessThanOrEqual(1);
    });
    expect(new Set(counts).size).toBe(8);
  });

  it('grows tokens in order: an earlier skill is never smaller than a later one', () => {
    steps(0, 1, 40).forEach((l) => {
      const scales = Array.from({ length: 7 }, (_, i) => tokenScale(i, l, 7));
      scales.slice(1).forEach((s, i) => expect(s).toBeLessThanOrEqual(scales[i]));
      scales.forEach((s) => expect(s >= 0 && s <= 1).toBe(true));
    });
  });

  it('widens the orbit as the ring grows', () => {
    expect(ringRadius(-1)).toBe(RING_MIN_RADIUS);
    expect(ringRadius(1)).toBe(RING_MAX_RADIUS);
    const radii: number[] = steps(0, 1, 20).map((l) => ringRadius(l));
    radii.slice(1).forEach((r, i) => expect(r).toBeGreaterThan(radii[i]));
  });

  it('is a function of local progress only, so scrolling back shrinks it the same way', () => {
    expect(tokensShown(0.55, 7)).toBe(tokensShown(0.55, 7));
    expect(tokenScale(3, 0.5, 7)).toBe(tokenScale(3, 0.5, 7));
  });

  it('draws the whole ring as one instanced mesh, one badge per skill in its own tint', () => {
    const orbit = skillOrbit(['terracotta', 'wheat', 'homeWarm']);
    expect(orbit.object).toBeInstanceOf(THREE.InstancedMesh);
    expect(orbit.object.instanceMatrix.count).toBe(3);
    const a = new THREE.Color();
    const b = new THREE.Color();
    orbit.object.getColorAt(0, a);
    orbit.object.getColorAt(1, b);
    expect(a.equals(b)).toBe(false);
  });
});
