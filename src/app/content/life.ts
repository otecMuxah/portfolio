export type Phase = 'build' | 'shatter' | 'rebuild' | 'garage';

/** Which builder renders a chapter's 3D scene (see scene/chapters). */
export type SceneKind = 'placeholder';

export interface Chapter {
  id: string;
  year: number;
  yearEnd?: number | 'now';
  place: string;
  title: string;
  body: string;
  phase: Phase;
  scene: SceneKind;
  /** Relative scroll length; the war chapter gets more so it can't be skimmed. */
  scrollWeight?: number;
}

export interface Car {
  id: string;
  name: string;
  colour: string;
  fromYear: number;
}

// Walking-skeleton sample; the full chapter list lands in ticket 03.
export const CHAPTERS: Chapter[] = [
  {
    id: 'birth',
    year: 1981,
    place: 'Kharkiv',
    title: 'Born in Kharkiv',
    body: '26 May 1981.',
    phase: 'build',
    scene: 'placeholder',
  },
  {
    id: 'family',
    year: 2006,
    place: 'Kharkiv',
    title: 'Met his wife',
    body: 'Met his wife in 2006.',
    phase: 'build',
    scene: 'placeholder',
  },
  {
    id: 'married',
    year: 2010,
    place: 'Kharkiv',
    title: 'Married, a daughter',
    body: 'Married in 2010; his daughter was born the same year.',
    phase: 'build',
    scene: 'placeholder',
  },
  {
    id: 'first-code',
    year: 2012,
    place: 'Kharkiv',
    title: 'Self-taught, first job',
    body: 'Started learning to code and landed a first job as a front-end developer at Webholder.',
    phase: 'build',
    scene: 'placeholder',
  },
  {
    id: 'iata',
    year: 2024,
    yearEnd: 'now',
    place: 'Frankfurt',
    title: 'IATA',
    body: 'Senior Full-Stack Developer (contract), leading a team of 6 developers within a 50-person engineering organisation.',
    phase: 'rebuild',
    scene: 'placeholder',
  },
];

export const CARS: Car[] = [
  { id: 'golf2', name: 'VW Golf 2', colour: 'red', fromYear: 2003 },
  { id: 'mazda323f', name: 'Mazda 323F (BA)', colour: 'red', fromYear: 2004 },
  { id: 'mazda3', name: 'Mazda 3', colour: 'blue', fromYear: 2006 },
  { id: 'forester', name: 'Subaru Forester SH', colour: 'green', fromYear: 2008 },
  { id: 'f30', name: 'BMW 320d F30', colour: 'black', fromYear: 2013 },
];
