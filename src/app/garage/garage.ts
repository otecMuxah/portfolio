import { Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
import { CARS } from '../content/life';
import { GARAGE_BAYS, GarageBay } from '../scene/chapters/garage';

/** Radians per dragged pixel: a drag across a car turns it about half way round. */
const DRAG = 0.012;
const STEP = Math.PI / 12;
const KEY_STEP: Record<string, number> = {
  ArrowRight: STEP,
  ArrowUp: STEP,
  ArrowLeft: -STEP,
  ArrowDown: -STEP,
  PageUp: STEP * 6,
  PageDown: -STEP * 6,
};

/**
 * Labels and spin controls laid over the garage's five cars. Each control is a slider over its car:
 * drag or swipe it sideways, or focus it and use the arrow keys. Positions follow the 3D scene every
 * frame and spins go straight to it, so none of this runs through change detection.
 */
@Component({
  selector: 'app-garage',
  template: `
    <ul
      class="garage"
      aria-label="The five cars. Drag a car, or focus it and use the arrow keys, to spin it."
    >
      @for (car of cars; track car.id) {
        <li class="garage__bay" [attr.data-car]="car.id">
          <p class="garage__label" [id]="'garage-' + car.id">
            <span class="garage__name">{{ car.name }}</span>
            <span class="garage__meta"
              >{{ car.colour }} · <span class="garage__owned">owned </span>from
              {{ car.fromYear }}</span
            >
          </p>
          <div
            class="garage__spin"
            role="slider"
            tabindex="0"
            [attr.aria-label]="'Spin the ' + car.name"
            [attr.aria-describedby]="'garage-' + car.id"
            aria-orientation="horizontal"
            aria-valuemin="0"
            aria-valuemax="359"
            aria-valuenow="0"
            aria-valuetext="0 degrees"
          ></div>
        </li>
      }
    </ul>
  `,
  styles: `
    .garage {
      position: fixed;
      inset: 0;
      margin: 0;
      padding: 0;
      list-style: none;
      pointer-events: none;
    }
    .garage__label,
    .garage__spin {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .garage__label {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 0;
      padding: 0.3rem 0.6rem;
      border-radius: 8px;
      background: rgb(13 15 20 / 78%);
      color: #f4efe6;
      font-size: 0.8rem;
      line-height: 1.3;
      text-align: center;
      white-space: nowrap;

      /* The leader down to the roof; its length is set per frame. */
      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: calc(50% + var(--leader-x, 0px));
        width: 1px;
        height: var(--leader, 0);
        background: rgb(244 239 230 / 55%);
      }
    }
    .garage__name {
      font-weight: 600;
    }
    .garage__meta {
      font-size: 0.72rem;
      opacity: 0.8;

      &::first-letter {
        text-transform: uppercase;
      }
    }
    .garage__spin {
      border-radius: 50%;
      cursor: grab;
      pointer-events: auto;
      /* Vertical swipes still scroll the page; sideways ones spin the car. */
      touch-action: pan-y;

      &:active {
        cursor: grabbing;
      }

      &:focus-visible {
        outline: 2px solid #ffb35c;
        outline-offset: 2px;
      }
    }
    @media (max-width: 767px) {
      .garage__label {
        padding: 0.2rem 0.4rem;
        font-size: 0.68rem;
      }
      .garage__meta {
        font-size: 0.62rem;
      }
      .garage__owned {
        display: none;
      }
    }
  `,
})
export class Garage {
  protected readonly cars = CARS;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const bays = GARAGE_BAYS.map((bay) => {
        const li = host.nativeElement.querySelector(`[data-car="${bay.id}"]`)!;
        return {
          bay,
          label: li.querySelector<HTMLElement>('.garage__label')!,
          spin: li.querySelector<HTMLElement>('.garage__spin')!,
        };
      });
      const cleanups = bays.map(({ bay, spin }) => bindSpin(bay, spin));
      const widths = bays.map(() => 0);
      let frame = requestAnimationFrame(function place() {
        const w = innerWidth / 2;
        const h = innerHeight / 2;
        // Read every label's width before writing any style, so the loop never forces a layout.
        bays.forEach(({ label }, i) => (widths[i] = label.offsetWidth));
        bays.forEach(({ bay, label, spin }, i) => {
          const x = (1 + bay.x) * w;
          const y = (1 - bay.y) * h;
          const metre = bay.metre * h;
          spin.style.width = `${metre * 4.2}px`;
          spin.style.height = `${metre * 2.6}px`;
          spin.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
          // Kept inside the viewport; the leader still drops to the car.
          const half = widths[i] / 2 + 4;
          const labelX = Math.min(Math.max((1 + bay.labelX) * w, half), innerWidth - half);
          label.style.transform = `translate(${labelX}px, ${(1 - bay.labelY) * h}px) translate(-50%, -100%)`;
          label.style.setProperty('--leader-x', `${x - labelX}px`);
          label.style.setProperty('--leader', `${Math.max((bay.labelY - bay.roofY) * h - 6, 0)}px`);
          const opacity = `${bay.shown}`;
          if (label.style.opacity !== opacity) {
            label.style.opacity = spin.style.opacity = opacity;
            // A car still dropping in can't be tabbed to or grabbed.
            spin.style.visibility = bay.shown > 0 ? '' : 'hidden';
          }
        });
        frame = requestAnimationFrame(place);
      });
      destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        cleanups.forEach((f) => f());
      });
    });
  }
}

/** Drag, swipe and arrow keys turn one car; returns a function that unbinds them. */
function bindSpin(bay: GarageBay, el: HTMLElement): () => void {
  let dragging: number | null = null;
  let lastX = 0;
  const turn = (by: number) => {
    bay.spin += by;
    const degrees = Math.round(degreesOf(bay.spin)) % 360;
    el.setAttribute('aria-valuenow', `${degrees}`);
    el.setAttribute('aria-valuetext', `${degrees} degrees`);
  };
  const down = (e: PointerEvent) => {
    dragging = e.pointerId;
    lastX = e.clientX;
    el.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== dragging) return;
    turn((e.clientX - lastX) * DRAG);
    lastX = e.clientX;
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId === dragging) dragging = null;
  };
  const key = (e: KeyboardEvent) => {
    const by = e.key === 'Home' ? -bay.spin : KEY_STEP[e.key];
    if (by === undefined) return;
    // Handled here, so the journey's own arrow-key navigation leaves the garage alone.
    e.preventDefault();
    turn(by);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', key);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('keydown', key);
  };
}

function degreesOf(radians: number): number {
  return ((((radians * 180) / Math.PI) % 360) + 360) % 360;
}
