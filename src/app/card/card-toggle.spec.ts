import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardToggle } from './card-toggle';

@Component({
  imports: [CardToggle],
  template: `<button appCardToggle aria-controls="details" [(expanded)]="open">Details</button>`,
})
class Host {
  readonly open = signal(false);
}

describe('CardToggle', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button, host: fixture.componentInstance };
  };

  it('is a plain button that starts collapsed', () => {
    const { button } = setup();
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('details');
  });

  it('opens and closes on click, writing the choice back to its owner', () => {
    const { fixture, button, host } = setup();
    button.click();
    fixture.detectChanges();
    expect(host.open()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(host.open()).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('follows its owner, so an open card stays open when the chapter changes', () => {
    const { fixture, button, host } = setup();
    host.open.set(true);
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
