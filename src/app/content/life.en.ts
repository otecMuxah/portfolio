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
    roles: [
      {
        company: 'Webholder',
        role: 'Front End Developer',
        years: '2012 – 2015',
        highlights: ['Delivered HTML and CSS markup for a tailoring management platform.'],
      },
    ],
  },
  'kharkiv-career': {
    label: 'Kharkiv career',
    place: 'Kharkiv',
    title: 'The Kharkiv career years',
    body: 'Growing as an engineer across three Kharkiv companies.',
    roles: [
      {
        company: 'Raccoon Gang',
        role: 'Frontend Developer',
        years: '2015 – 2018',
        highlights: [
          'Customised the OpenEdX platform, delivering hundreds of tailored EdX environments.',
        ],
      },
      {
        company: 'Eastern Peak',
        role: 'JavaScript Developer',
        years: '2018 – 2019',
        highlights: [
          'Built FYRE, a restaurant management and delivery CMS, with a first load under one second.',
        ],
      },
      {
        company: 'TEAM International',
        role: 'JavaScript Engineer',
        years: '2019 – 2021',
        highlights: ['Cut page load time from 25 seconds to 6 through lazy loading.'],
      },
    ],
    skills: ['Angular', 'TypeScript', 'RxJS', 'JavaScript', 'HTML5', 'SCSS/CSS', 'Django'],
  },
  krakow: {
    label: 'Kraków',
    place: 'Kraków',
    title: 'Kraków: leading the front end',
    body: 'In 2021 he moved to Kraków, leading the front end at Corporate Finance Institute, headquartered in Warsaw.',
    roles: [
      {
        company: 'Corporate Finance Institute',
        role: 'Lead Frontend Developer',
        years: '2020 – 2022',
        highlights: [
          'Founded and architected the front end of a finance learning platform for 100,000+ users: sub-1s load, sub-200KB bundle.',
          'Led a team of 5 as head of the front-end function.',
        ],
      },
      {
        company: 'PENTASOFT',
        role: 'JavaScript Developer, part-time',
        years: '2021 – 2022',
        highlights: ['Built NEURON, an IoT platform for real-time monitoring of sensor networks.'],
      },
    ],
  },
  'back-home': {
    label: 'Back home',
    place: 'Kharkiv',
    title: 'Back to Kharkiv',
    body: 'Early 2022: home again in Kharkiv, in the world he had built.',
    roles: [
      {
        company: 'Corporate Finance Institute',
        role: 'Lead Frontend Developer',
        years: '2020 – 2022',
        highlights: [
          "Created CFI's cross-platform mobile app from its first commit and shipped it to both stores single-handed.",
        ],
      },
    ],
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
