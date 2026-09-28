import type { ChapterId, ChapterText } from './life';

// Facts come only from spec #1 and cv-maliavin-2026-europe.txt. Family members stay unnamed.
export const EN: Record<ChapterId, ChapterText> = {
  birth: { label: 'Birth', place: 'Kharkiv', title: 'Born in Kharkiv', body: '26 May 1981.' },
  school: {
    label: 'School',
    place: 'Kharkiv',
    title: 'School No. 126',
    body: 'Where it began: School No. 126 in Kharkiv.',
  },
  lyceum: {
    label: 'Lyceum',
    place: 'Kharkiv',
    title: 'Physics and Mathematics Lyceum No. 27',
    body: 'In 8th grade he moved to the Physics and Mathematics Lyceum No. 27: the start of his technical roots.',
  },
  university: {
    label: 'University',
    place: 'Kharkiv',
    title: "Two master's degrees",
    body: 'Business Management at National Kharkiv Polytechnic University, and Jurisprudence at Kharkiv National University of Internal Affairs.',
  },
  dreamweaver: {
    label: 'First websites',
    title: 'Websites in Dreamweaver',
    body: 'In 2000 he was already building websites with Macromedia Dreamweaver, long before the web was his job.',
  },
  family: {
    label: 'Family',
    title: 'Family',
    body: 'He met his wife in 2006. They married in 2010, and their daughter was born the same year.',
  },
  rally: {
    label: 'Rally',
    title: 'Amateur rally',
    body: 'Amateur rally: occasional non-pro events, 2008–2013',
  },
  'first-code': {
    label: 'First code',
    place: 'Ukraine',
    title: 'Self-taught, first job',
    body: 'Taught himself to code and landed a first job as a front-end developer at Webholder.',
  },
  'kharkiv-career': {
    label: 'Kharkiv career',
    place: 'Kharkiv',
    title: 'The Kharkiv career years',
    body: 'Frontend Developer at Raccoon Gang (2015–2018), JavaScript Developer at Eastern Peak (2018–2019), JavaScript Engineer at TEAM International (2019–2021).',
  },
  krakow: {
    label: 'Kraków',
    place: 'Kraków',
    title: 'Kraków: leading the front end',
    body: 'Lead Frontend Developer at Corporate Finance Institute: founded the front end of a finance learning platform for 100,000+ users, led a team of 5 and shipped its mobile app single-handed. Part-time JavaScript Developer at PENTASOFT alongside.',
  },
  'back-home': {
    label: 'Back home',
    place: 'Kharkiv',
    title: 'Back to Kharkiv',
    body: 'Early 2022: home again in Kharkiv, in the world he had built.',
  },
  war: {
    label: 'War',
    place: 'Kharkiv',
    title: '24.02.2022',
    body: '4 a.m. Explosions. 5 a.m. Family in the car. West. Then Europe. The life he built in Kharkiv, left behind.',
  },
  ciklum: {
    label: 'Ciklum',
    place: 'Germany',
    title: 'Ciklum: starting from scratch',
    body: 'Rebuilding life and career in Germany. Lead Frontend Developer on Redstor (2022–2023), then Senior Frontend Developer on Deloitte (2023–2024).',
  },
  iata: {
    label: 'IATA',
    place: 'Frankfurt',
    title: 'IATA',
    body: 'Senior Full-Stack Developer (contract), leading a team of 6 developers within a 50-person engineering organisation. AI-agent delivery across AMSS, ARM Index, ATMPM and ASPAC.',
  },
  garage: {
    label: 'Garage',
    title: 'The garage',
    body: 'All five cars side by side: the red VW Golf 2, the red Mazda 323F, the blue Mazda 3, the green Subaru Forester and the black BMW 320d F30. Fixing, racing and cleaning cars.',
  },
};
