import { FLIGHT, gather, gatherDelays } from './particles';

describe('particle gather', () => {
  const from = new Float32Array([0, 0, 0, 10, 10, 10]);
  const to = new Float32Array([4, 8, -4, 0, 0, 0]);

  it('keeps every particle in the cloud at 0 and on its target at 1', () => {
    const delays = gatherDelays(2, 3);
    const out = new Float32Array(6);
    gather(out, from, to, delays, 0);
    expect([...out]).toEqual([...from]);
    gather(out, from, to, delays, 1);
    expect([...out]).toEqual([...to]);
  });

  it('staggers departures so particles land at different moments', () => {
    const delays = new Float32Array([0, 1 - FLIGHT]);
    const out = new Float32Array(6);
    gather(out, from, to, delays, FLIGHT);
    expect(out[0]).toBeCloseTo(4);
    expect(out[3]).toBeCloseTo(10);
  });

  it('gives the same positions for the same progress, whichever way the visitor scrolled', () => {
    const delays = gatherDelays(2, 9);
    const forward = new Float32Array(6);
    const back = new Float32Array(6);
    gather(forward, from, to, delays, 0.5);
    gather(back, from, to, delays, 0.9);
    gather(back, from, to, delays, 0.5);
    expect([...back]).toEqual([...forward]);
  });

  it('seeds departures inside the gather range', () => {
    const delays = gatherDelays(500, 1);
    expect([...delays]).toEqual([...gatherDelays(500, 1)]);
    delays.forEach((d) => expect(d >= 0 && d <= 1 - FLIGHT).toBe(true));
  });
});
