import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHAPTERS } from './content/life';
import { JourneyState, chapterSpans, journeyAt } from './journey/journey';
import { SceneEngine } from './scene/scene-engine';

gsap.registerPlugin(ScrollTrigger);

const sameState = (a: JourneyState, b: JourneyState) =>
  a.chapterId === b.chapterId && a.carId === b.carId && a.phase === b.phase;

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '[attr.data-chapter]': 'state().chapterId',
    '[attr.data-car]': 'state().carId ?? "none"',
    '[attr.data-phase]': 'state().phase',
  },
})
export class App {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly state = signal<JourneyState>(journeyAt(0), { equal: sameState });
  protected readonly chapter = computed(() => CHAPTERS.find((c) => c.id === this.state().chapterId)!);
  protected readonly trackHeight = `${CHAPTERS.reduce((sum, c) => sum + (c.scrollWeight ?? 1), 0) * 100}vh`;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const engine = new SceneEngine(this.canvas().nativeElement, chapterSpans());
      const trigger = ScrollTrigger.create({
        trigger: this.track().nativeElement,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: ({ progress }) => {
          engine.setProgress(progress);
          this.state.set(journeyAt(progress));
        },
      });
      destroyRef.onDestroy(() => {
        trigger.kill();
        engine.dispose();
      });
    });
  }
}
