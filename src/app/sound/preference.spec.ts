import { SOUND_KEY, readSoundPreference, writeSoundPreference } from './preference';

const memory = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
};

const blocked = (): Storage => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe('sound preference', () => {
  it('is off for a first visit', () => {
    const storage = memory();
    expect(readSoundPreference(() => storage)).toBe(false);
  });

  it('remembers on and off', () => {
    const storage = memory();
    writeSoundPreference(true, () => storage);
    expect(storage.getItem(SOUND_KEY)).toBe('on');
    expect(readSoundPreference(() => storage)).toBe(true);
    writeSoundPreference(false, () => storage);
    expect(readSoundPreference(() => storage)).toBe(false);
  });

  it('treats an unknown stored value as off', () => {
    const storage = memory();
    storage.setItem(SOUND_KEY, 'yes');
    expect(readSoundPreference(() => storage)).toBe(false);
  });

  it('stays off, without throwing, where storage is blocked', () => {
    expect(() => writeSoundPreference(true, blocked)).not.toThrow();
    expect(readSoundPreference(blocked)).toBe(false);
  });
});
