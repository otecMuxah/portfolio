import { Component } from '@angular/core';
import { CONTACTS, PROFILE } from '../content/cv';
import { ageOn } from './age';

@Component({
  selector: 'app-hero',
  template: `
    <h1 class="hero__tagline">{{ age }} years, one journey.</h1>
    <p class="hero__name">{{ profile.name }}</p>
    <p class="hero__title">{{ profile.title }}</p>
    <ul class="hero__contacts" aria-label="Contact">
      @for (c of contacts; track c.label) {
        <li>
          <a
            [href]="c.href"
            rel="noopener"
            [attr.target]="c.href.startsWith('http') ? '_blank' : null"
            >{{ c.label }}</a
          >
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0 0 auto;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 18vh;
      box-sizing: border-box;
      color: #f4efe6;
      text-align: center;
      text-shadow: 0 1px 8px rgb(13 15 20 / 80%);
      pointer-events: none;
    }
    .hero__tagline {
      margin: 0;
      font-size: clamp(2rem, 6vw, 4rem);
    }
    .hero__name {
      margin: 1rem 0 0;
      font-size: 1.4rem;
    }
    .hero__title {
      margin: 0.25rem 0 0;
      opacity: 0.8;
    }
    .hero__contacts {
      display: flex;
      gap: 1.25rem;
      margin: 1.25rem 0 0;
      padding: 0;
      list-style: none;
      pointer-events: auto;
    }
    a {
      color: inherit;
    }
  `,
})
export class Hero {
  protected readonly profile = PROFILE;
  protected readonly contacts = CONTACTS;
  protected readonly age = ageOn(PROFILE.birthDate, new Date());
}
