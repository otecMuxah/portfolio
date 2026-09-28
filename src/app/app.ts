import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHAPTERS, CHAPTER_TEXT, Chapter, ChapterId } from './content/life';
import { CvView } from './cv/cv-view';
import { Hero } from './hero/hero';
import { JourneyState, chapterSpans, journeyAt } from './journey/journey';
import { SceneEngine } from './scene/scene-engine';

gsap.registerPlugin(ScrollTrigger);

const SPANS = chapterSpans();
const TEXT = CHAPTER_TEXT.en;
const NEXT_KEYS = ['ArrowDown', 'ArrowRight', 'PageDown'];
const PREV_KEYS = ['ArrowUp', 'ArrowLeft', 'PageUp'];
/** Keys pressed here belong to the control or dialog, not the journey. */
const KEEPS_KEYS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog';
/** How long a jump target counts for repeated key presses, where `scrollend` never fires. */
const PENDING_MS = 1500;

const sameState = (a: JourneyState, b: JourneyState) =>
  a.chapterId === b.chapterId && a.carId === b.carId && a.phase === b.phase;

const years = (c: Chapter) => (c.year === undefined ? '' : c.yearEnd ? `${c.year} – ${c.yearEnd}` : `${c.year}`);

const isChapterId = (id: string): id is ChapterId => CHAPTERS.some((c) => c.id === id);

@Component({
  selector: 'app-root',
  imports: [Hero, CvView],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '[attr.data-chapter]': 'state().chapterId',
    '[attr.data-car]': 'state().carId ?? "none"',
    '[attr.data-phase]': 'state().phase',
    '[attr.data-scene]': 'loaded() < 1 ? "loading" : "ready"',
    '(window:keydown)': 'onKey($event)',
  },
})
export class App {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly nav = viewChild.required<ElementRef<HTMLElement>>('nav');

  /** How far the 3D scene has initialised, 0..1; the loader shows until it reaches 1. */
  protected readonly loaded = signal(0);
  protected readonly percent = computed(() => Math.round(this.loaded() * 100));
  protected readonly state = signal<JourneyState>(journeyAt(0), { equal: sameState });
  protected readonly chapter = computed(() => CHAPTERS.find((c) => c.id === this.state().chapterId)!);
  protected readonly text = computed(() => TEXT[this.state().chapterId]);
  protected readonly meta = computed(() =>
    [years(this.chapter()), this.text().place].filter(Boolean).join(' · '),
  );
  protected readonly timeline = CHAPTERS.map((c) => ({ id: c.id, year: c.year, label: TEXT[c.id].label }));
  protected readonly trackHeight = `${CHAPTERS.reduce((sum, c) => sum + (c.scrollWeight ?? 1), 0) * 100}vh`;

  /** Chapter a keyboard or timeline jump is flying to, so repeated key presses keep counting from it. */
  private pending: number | null = null;
  private pendingUntil = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const engine = new SceneEngine(this.canvas().nativeElement, SPANS);
      engine.load((progress) => this.loaded.set(progress));
      const trigger = ScrollTrigger.create({
        trigger: this.track().nativeElement,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: ({ progress }) => {
          engine.setProgress(progress);
          const previous = this.state().chapterId;
          this.state.set(journeyAt(progress));
          const { chapterId } = this.state();
          if (chapterId !== previous) {
            history.replaceState(null, '', `#${chapterId}`);
            this.revealInTimeline(this.indexOf(chapterId));
          }
          if (this.pending === this.indexOf(chapterId)) this.pending = null;
        },
      });
      const followHash = (behavior: ScrollBehavior) => {
        const id = decodeURIComponent(location.hash.slice(1));
        if (isChapterId(id)) this.flyTo(id, behavior);
      };
      const onHashChange = () => followHash('smooth');
      const onScrollEnd = () => (this.pending = null);
      followHash('instant');
      addEventListener('hashchange', onHashChange);
      addEventListener('scrollend', onScrollEnd);
      destroyRef.onDestroy(() => {
        removeEventListener('hashchange', onHashChange);
        removeEventListener('scrollend', onScrollEnd);
        trigger.kill();
        engine.dispose();
      });
    });
  }

  protected onTimelineClick(event: MouseEvent, id: ChapterId): void {
    event.preventDefault();
    history.replaceState(null, '', `#${id}`);
    this.flyTo(id);
  }

  protected onKey(event: KeyboardEvent): void {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREV_KEYS.includes(event.key) ? -1 : 0;
    if (!step || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest(KEEPS_KEYS)) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    const pending = performance.now() < this.pendingUntil ? this.pending : null;
    const from = pending ?? this.indexOf(this.state().chapterId);
    const to = Math.min(Math.max(from + step, 0), CHAPTERS.length - 1);
    this.flyTo(CHAPTERS[to].id);
  }

  /** Scroll so the journey sits mid-chapter, where the camera frames that chapter. */
  private flyTo(id: ChapterId, behavior: ScrollBehavior = 'smooth'): void {
    const index = this.indexOf(id);
    const { start, end } = SPANS[index];
    const max = document.documentElement.scrollHeight - innerHeight;
    this.pending = index;
    this.pendingUntil = performance.now() + PENDING_MS;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) behavior = 'instant';
    scrollTo({ top: (max * (start + end)) / 2, behavior });
  }

  /** Keep the current item visible where the timeline scrolls sideways (phones), without scrolling the page. */
  private revealInTimeline(index: number): void {
    const nav = this.nav().nativeElement;
    const item = nav.querySelectorAll('.timeline__item')[index];
    if (!item) return;
    const box = nav.getBoundingClientRect();
    const { left, right } = item.getBoundingClientRect();
    if (left < box.left) nav.scrollLeft += left - box.left;
    else if (right > box.right) nav.scrollLeft += right - box.right;
  }

  private indexOf(id: ChapterId): number {
    return CHAPTERS.findIndex((c) => c.id === id);
  }
}
