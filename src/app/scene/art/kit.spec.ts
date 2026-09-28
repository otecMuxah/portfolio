import * as THREE from 'three';
import { block, enter, glow, halo, haloMap, leave, lightPool, lowPoly, mergedMesh, seeded, smoothstep } from './kit';

describe('art kit', () => {
  // jsdom has no 2D canvas; the halo gradient only needs somewhere to draw.
  beforeAll(() => {
    const ctx = { createRadialGradient: () => ({ addColorStop: () => undefined }), fillRect: () => undefined };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  });

  it('smoothstep clamps to 0 and 1 outside its edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('builds a chapter in before it is framed and keeps it built while framed', () => {
    expect(enter(-1)).toBe(0);
    expect(enter(0.3)).toBe(1);
    expect(leave(0.5)).toBe(0);
    expect(leave(2)).toBe(1);
  });

  it('never runs enter backwards as the visitor scrolls forward', () => {
    const steps = Array.from({ length: 41 }, (_, i) => enter(-1 + i * 0.05));
    steps.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(steps[i]));
  });

  it('shares one material per palette colour and a fresh one per glow', () => {
    expect(lowPoly('brick')).toBe(lowPoly('brick'));
    expect(lowPoly('brick')).not.toBe(lowPoly('chalk'));
    expect(glow('candle')).not.toBe(glow('candle'));
  });

  it('repeats the same random sequence for the same seed', () => {
    const a = seeded(7);
    const b = seeded(7);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    first.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
  });

  it('stands a block on its base', () => {
    const box = new THREE.Box3().setFromBufferAttribute(block(2, 3, 4, 1, -1, 5).getAttribute('position') as THREE.BufferAttribute);
    expect(box.min.toArray()).toEqual([0, 5, -3]);
    expect(box.max.toArray()).toEqual([2, 8, 1]);
  });

  it('merges parts into one mesh with all their triangles', () => {
    const mesh = mergedMesh([block(1, 1, 1, 0, 0), new THREE.IcosahedronGeometry(1, 0)], lowPoly('chalk'));
    expect(mesh.geometry.getAttribute('position').count / 3).toBe(12 + 20);
  });

  it('fakes light with additive halos and pools that share one gradient texture', () => {
    const sprite = halo('candle', 3, 0.2);
    expect(sprite.scale.x).toBe(3);
    expect(sprite.material.opacity).toBe(0.2);
    expect(sprite.material.blending).toBe(THREE.AdditiveBlending);
    expect(sprite.material.map).toBe(haloMap());
    expect(halo('screenGlow', 1).material.map).toBe(haloMap());
    expect(lightPool('candle', 2, 2).material.map).toBe(haloMap());
  });
});
