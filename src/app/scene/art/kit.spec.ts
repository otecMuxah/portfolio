import { enter, glow, leave, lowPoly, seeded, smoothstep } from './kit';

describe('art kit', () => {
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
});
