export const SOUND_KEY = 'portfolio.sound';

/** Browser only: reading `localStorage` itself throws where site data is blocked. */
const local = () => localStorage;

/** Whether the visitor turned sound on last time. Off when unset or storage is unavailable. */
export function readSoundPreference(storage: () => Storage = local): boolean {
  try {
    return storage().getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Remember the choice; a blocked storage (private mode) just means it isn't kept. */
export function writeSoundPreference(on: boolean, storage: () => Storage = local): void {
  try {
    storage().setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered, still applied for this visit.
  }
}
