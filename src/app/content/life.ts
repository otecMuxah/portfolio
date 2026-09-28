import { EN, EN_DOMAINS } from './life.en';

export type Phase = 'build' | 'shatter' | 'rebuild';

/** Which builder renders a chapter's 3D scene (see scene/chapters). */
export type SceneKind =
  | 'placeholder'
  | 'birth'
  | 'school'
  | 'lyceum'
  | 'university'
  | 'dreamweaver'
  | 'family'
  | 'rally'
  | 'first-code'
  | 'kharkiv-career'
  | 'krakow'
  | 'back-home'
  | 'war'
  | 'ciklum'
  | 'iata';

export type ChapterId =
  | 'birth'
  | 'school'
  | 'lyceum'
  | 'university'
  | 'dreamweaver'
  | 'family'
  | 'rally'
  | 'first-code'
  | 'kharkiv-career'
  | 'krakow'
  | 'back-home'
  | 'war'
  | 'ciklum'
  | 'iata';

export interface Chapter {
  id: ChapterId;
  /** Omitted where no year has been given; such chapters carry no car. */
  year?: number;
  yearEnd?: number | 'now';
  phase: Phase;
  scene: SceneKind;
  /**
   * Relative scroll length; the war chapter gets more so it can't be skimmed, and Ciklum a little more so the road
   * out of the war's park is calm.
   */
  scrollWeight?: number;
}

/** A chapter's words, keyed by chapter id per locale so other languages can be added later. */
export interface ChapterText {
  /** Short name on the timeline. */
  label: string;
  place?: string;
  title: string;
  body: string;
  /** Stand-in text until Mykhailo supplies his own words. */
  placeholder?: true;
  /** Career chapters: the jobs held, as the card names them. */
  roles?: RoleCard[];
}

export interface RoleCard {
  company: string;
  role: string;
  years: string;
  /** One to three, taken from the CV. */
  highlights: string[];
  /** The employer a client role was held through, as the CV names it ("via Ciklum"). */
  via?: string;
  /** What the work was about, only where the CV or the owner states it; the scene shows its emblem. */
  domain?: Domain;
  /** The stack used at this step, taken from the CV; the card lists it and the scene's badges carry it. */
  tech: string[];
}

/** Domains the CV (or the owner) names for a career step; each has a low-poly emblem in the scene (scene/work). */
export type Domain =
  | 'tailoring'
  | 'edtech'
  | 'restaurants'
  | 'healthcare'
  | 'iot'
  | 'data-protection'
  | 'aviation'
  | 'fintech';

export type Locale = 'en';

export const CHAPTER_TEXT: Record<Locale, Record<ChapterId, ChapterText>> = { en: EN };

/** How the card and the scene's nameplate name each domain. */
export const DOMAIN_TEXT: Record<Locale, Record<Domain, string>> = { en: EN_DOMAINS };

export type CarId = 'golf2' | 'mazda323f' | 'mazda3' | 'forester' | 'f30';

export interface Car {
  id: CarId;
  name: string;
  colour: string;
  fromYear: number;
}

export const CHAPTERS: Chapter[] = [
  { id: 'birth', year: 1981, phase: 'build', scene: 'birth' },
  { id: 'school', year: 1987, yearEnd: 1994, phase: 'build', scene: 'school' },
  { id: 'lyceum', year: 1994, yearEnd: 1998, phase: 'build', scene: 'lyceum' },
  { id: 'university', year: 1998, yearEnd: 2004, phase: 'build', scene: 'university' },
  { id: 'dreamweaver', year: 2000, phase: 'build', scene: 'dreamweaver' },
  { id: 'family', year: 2006, yearEnd: 2010, phase: 'build', scene: 'family' },
  { id: 'rally', year: 2008, yearEnd: 2013, phase: 'build', scene: 'rally' },
  { id: 'first-code', year: 2012, phase: 'build', scene: 'first-code' },
  { id: 'kharkiv-career', year: 2015, yearEnd: 2021, phase: 'build', scene: 'kharkiv-career' },
  { id: 'krakow', year: 2021, phase: 'build', scene: 'krakow' },
  { id: 'back-home', year: 2022, phase: 'build', scene: 'back-home' },
  { id: 'war', year: 2022, phase: 'shatter', scene: 'war', scrollWeight: 3 },
  { id: 'ciklum', year: 2022, yearEnd: 2024, phase: 'rebuild', scene: 'ciklum', scrollWeight: 2.4 },
  { id: 'iata', year: 2024, yearEnd: 'now', phase: 'rebuild', scene: 'iata' },
];

/** A country on the road out of the war: its code and the name its roadside sign reads. */
export interface RouteCountry {
  code: string;
  name: string;
}

/** February 2022: the way he drove his family out of the war, in the F30, in order. */
export const ESCAPE_ROUTE: RouteCountry[] = [
  { code: 'MD', name: 'Moldova' },
  { code: 'RO', name: 'Romania' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'IT', name: 'Italy' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
];

export const CARS: Car[] = [
  { id: 'golf2', name: 'VW Golf 2', colour: 'red', fromYear: 2003 },
  { id: 'mazda323f', name: 'Mazda 323F (BA)', colour: 'red', fromYear: 2004 },
  { id: 'mazda3', name: 'Mazda 3', colour: 'blue', fromYear: 2006 },
  { id: 'forester', name: 'Subaru Forester SH', colour: 'green', fromYear: 2008 },
  { id: 'f30', name: 'BMW 320d F30', colour: 'black', fromYear: 2016 },
];
