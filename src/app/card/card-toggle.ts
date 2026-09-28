import { Directive, model } from '@angular/core';

/** Opens and closes the chapter card's details on phones; the choice lives with the caller, so it outlasts a chapter. */
@Directive({
  selector: 'button[appCardToggle]',
  host: {
    type: 'button',
    '[attr.aria-expanded]': 'expanded()',
    '(click)': 'expanded.set(!expanded())',
  },
})
export class CardToggle {
  readonly expanded = model(false);
}
