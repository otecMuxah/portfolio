import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { chapterSpans } from '../journey/journey';
import { ambientLevel, rumbleLevel, warSpan } from './mix';
import { readSoundPreference, writeSoundPreference } from './preference';
import { Soundscape } from './soundscape';

const WAR = warSpan(chapterSpans());
/** Events that count as a user gesture, so a remembered "on" can start the audio. */
const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const;

/**
 * The sound toggle's state and the soundtrack behind it. Silent by default: no AudioContext exists
 * until the visitor turns sound on. Scroll progress goes straight to the audio graph, never through
 * change detection; only `on` is a signal.
 */
@Injectable({ providedIn: 'root' })
export class Sound {
  readonly on = signal(false);
  private scape: Soundscape | null = null;
  private progress = 0;
  /** A remembered "on" is waiting for the visitor's first gesture. */
  private waiting = false;
  private readonly onGesture = (event: Event) => {
    // The toggle's own press is handled by toggle(); starting here would blip before it turns off.
    if (event.target instanceof Element && event.target.closest('[data-sound-toggle]')) return;
    this.start();
  };
  /** A hidden tab goes quiet; it comes back only if sound is still on. */
  private readonly onVisibility = () => {
    if (document.hidden) this.scape?.pause();
    else if (this.on()) this.scape?.enable();
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopWaiting();
      if (this.scape) document.removeEventListener('visibilitychange', this.onVisibility);
      this.scape?.dispose();
    });
  }

  /**
   * Browser only. A remembered "on" shows the toggle pressed, but browsers only let audio start
   * from a user gesture, so it starts on the visitor's first click, tap or key press.
   */
  restore(): void {
    if (!readSoundPreference()) return;
    this.on.set(true);
    this.waiting = true;
    for (const type of GESTURES) addEventListener(type, this.onGesture, { capture: true });
  }

  /** Called from the toggle's click, itself a user gesture. */
  toggle(): void {
    const on = !this.on();
    this.on.set(on);
    writeSoundPreference(on);
    if (on) this.start();
    else {
      this.stopWaiting();
      this.scape?.disable();
    }
  }

  /** Journey progress 0..1, on every scroll update. */
  setProgress(progress: number): void {
    this.progress = progress;
    this.scape?.setLevels(ambientLevel(progress, WAR), rumbleLevel(progress, WAR));
  }

  private start(): void {
    if (!this.scape) document.addEventListener('visibilitychange', this.onVisibility);
    this.scape ??= new Soundscape(
      ambientLevel(this.progress, WAR),
      rumbleLevel(this.progress, WAR),
    );
    this.scape.enable().then((running) => {
      if (running && this.on()) this.stopWaiting();
    });
  }

  private stopWaiting(): void {
    if (!this.waiting) return;
    this.waiting = false;
    for (const type of GESTURES) removeEventListener(type, this.onGesture, { capture: true });
  }
}
