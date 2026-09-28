import { ageOn } from './age';

describe('ageOn', () => {
  const born = new Date(1981, 4, 26);

  it('is 44 the day before the 2026 birthday', () => {
    expect(ageOn(born, new Date(2026, 4, 25))).toBe(44);
  });

  it('turns 45 on 26 May 2026', () => {
    expect(ageOn(born, new Date(2026, 4, 26))).toBe(45);
  });

  it('stays 45 the day after', () => {
    expect(ageOn(born, new Date(2026, 4, 27))).toBe(45);
  });
});
