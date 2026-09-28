import { EN } from './life.en';

export type Phase = 'build' | 'shatter' | 'rebuild' | 'garage';

/** Which builder renders a chapter's 3D scene (see scene/chapters). */
export type SceneKind =
  | 'placeholder'
  | 'birth'
  | 'school'
  | 'lyceum'
  | 'university'
  | 'dreamweaver'
  | 'family'
  | 'garage';

export type ChapterId =
  | 'birth'
  | 'school'
  | 'lyceum'
  | 'university'
  | 'dreamweaver'
  | 'family'
  | 'first-code'
  | 'kharkiv-career'
  | 'krakow'
  | 'back-home'
  | 'war'
  | 'ciklum'
  | 'iata'
  | 'garage';

export interface Chapter {
  id: ChapterId;
  /** Omitted where no year has been given; such chapters carry no car. */
  year?: number;
  yearEnd?: number | 'now';
  phase: Phase;
  scene: SceneKind;
  /** Relative scroll length; the war chapter gets more so it can't be skimmed. */
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
}

export type Locale = 'en';

export const CHAPTER_TEXT: Record<Locale, Record<ChapterId, ChapterText>> = { en: EN };

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
  { id: 'first-code', year: 2012, phase: 'build', scene: 'placeholder' },
  { id: 'kharkiv-career', year: 2015, yearEnd: 2021, phase: 'build', scene: 'placeholder' },
  { id: 'krakow', year: 2021, phase: 'build', scene: 'placeholder' },
  { id: 'back-home', year: 2022, phase: 'build', scene: 'placeholder' },
  { id: 'war', year: 2022, phase: 'shatter', scene: 'placeholder' },
  { id: 'ciklum', year: 2022, yearEnd: 2024, phase: 'rebuild', scene: 'placeholder' },
  { id: 'iata', year: 2024, yearEnd: 'now', phase: 'rebuild', scene: 'placeholder' },
  { id: 'garage', phase: 'garage', scene: 'garage' },
];

export const CARS: Car[] = [
  { id: 'golf2', name: 'VW Golf 2', colour: 'red', fromYear: 2003 },
  { id: 'mazda323f', name: 'Mazda 323F (BA)', colour: 'red', fromYear: 2004 },
  { id: 'mazda3', name: 'Mazda 3', colour: 'blue', fromYear: 2006 },
  { id: 'forester', name: 'Subaru Forester SH', colour: 'green', fromYear: 2008 },
  { id: 'f30', name: 'BMW 320d F30', colour: 'black', fromYear: 2013 },
];
