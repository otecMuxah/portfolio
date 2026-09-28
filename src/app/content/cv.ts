// Transcribed from cv-maliavin-2026-europe.txt. The phone number is left out on purpose.

export interface Contact {
  label: string;
  text: string;
  href: string;
}

export interface Role {
  title: string;
  company: string;
  location: string;
  dates: string;
  note?: string;
  highlights: string[];
}

export interface SkillGroup {
  area: string;
  items: string;
}

export const PROFILE = {
  name: 'Mykhailo Maliavin',
  title: 'Lead Full-Stack Engineer',
  stack: 'Angular · Java/Spring Boot · Python/Django',
  /** Month is zero-based: 26 May 1981. */
  birthDate: new Date(1981, 4, 26),
  location: 'Frankfurt am Main, Germany',
  languages: 'English (C1) · German (B1) · Ukrainian (Native) · Russian (Native)',
};

export const CONTACTS: Contact[] = [
  { label: 'Email', text: 'otecmuxah@gmail.com', href: 'mailto:otecmuxah@gmail.com' },
  {
    label: 'LinkedIn',
    text: 'linkedin.com/in/mykhailo-maliavin',
    href: 'https://www.linkedin.com/in/mykhailo-maliavin',
  },
  { label: 'GitHub', text: 'github.com/otecMuxah', href: 'https://github.com/otecMuxah' },
];

export const CV_SUMMARY =
  'Engineering lead with over a decade building highly scalable, performant web applications - Angular and TypeScript on the front end, Java/Spring Boot and Python/Django behind it. Currently leading 6 developers within a 50-person engineering organisation at IATA.';

export const ROLES: Role[] = [
  {
    title: 'Senior Full-Stack Developer (Contract)',
    company: 'International Air Transport Association',
    location: 'Geneva, Switzerland (remote)',
    dates: '2024 - Present',
    highlights: [
      'Leading a team of 6 developers within a 50-person engineering organisation, delivering four platforms across aviation operations, certification and finance.',
      'Integrated AI agents into the development flow, taking a ticket from its number to an open pull request: plan, test-first implementation, Playwright end-to-end verification and the PR description.',
      'AMSS: delivered 138 Jira stories and defects end to end across an Angular 22 client and six Java 25 / Spring Boot 4 microservices for the ISAGO certification programme.',
      "ARM Index: principal engineer on IATA's public Airline Retailing Maturity Index (Django 6 / Python 3.13); introduced its first Playwright E2E and visual-regression suite.",
      'ATMPM: built a Next.js 15 / React 18 application for monitoring and forecasting air traffic management performance, with AI-powered analysis via Genkit.',
      'ASPAC Portal: built accounts-receivable workspaces for seven international stations and multi-step financial import wizards in Angular 20.',
    ],
  },
  {
    title: 'Senior Frontend Developer (via Ciklum)',
    company: 'Deloitte',
    location: 'Kyiv, Ukraine (remote)',
    dates: '2023 - 2024',
    highlights: [
      "Angular front-end development over .NET services within Deloitte's POD v5 team, in a team of 8 working Agile with Azure DevOps.",
      'Migrated the front end to an Nx monorepo with module federation, improving application performance by 40%.',
    ],
  },
  {
    title: 'Lead Frontend Developer (via Ciklum)',
    company: 'Redstor',
    location: 'Kyiv, Ukraine (remote)',
    dates: '2022 - 2023',
    highlights: [
      'Led front-end development on a cloud data-protection platform, Angular over .NET services, in a team of 8.',
      'Owned the front-end architecture and the day-to-day direction of the work.',
    ],
  },
  {
    title: 'Lead Frontend Developer',
    company: 'Corporate Finance Institute',
    location: 'Warsaw, Poland / remote',
    dates: '2020 - 2022',
    highlights: [
      "Founded and architected the front end of Canada's most popular online finance learning platform (100,000+ users), holding sub-1s load time and a sub-200KB bundle.",
      "Created CFI's cross-platform mobile app from its first commit and shipped it to both stores single-handed (Angular, Ionic + Capacitor).",
      'Led a team of 5 as head of the front-end function.',
    ],
  },
  {
    title: 'Javascript Developer, part-time',
    company: 'PENTASOFT',
    location: 'Madrid, Spain (remote)',
    dates: '2021 - 2022',
    note: 'Concurrent with the CFI role',
    highlights: [
      'Built NEURON, an IoT platform giving growers real-time monitoring of sensor networks, in Angular 12-13 with NGXS and GraphQL.',
    ],
  },
  {
    title: 'Javascript Engineer',
    company: 'TEAM International',
    location: 'Kharkiv, Ukraine',
    dates: '2019 - 2021',
    highlights: [
      'Built VaultMR, a platform for managing rehabilitation clinics, with HL7, eRehab and HIPAA compliance.',
      'Migrated a hybrid AngularJS application to Angular 2+.',
      'Cut page load time from 25 seconds to 6 through lazy loading.',
    ],
  },
  {
    title: 'Javascript Developer',
    company: 'Eastern Peak',
    location: 'Kharkiv, Ukraine',
    dates: '2018 - 2019',
    highlights: [
      'Built FYRE, a restaurant management and delivery CMS in Angular / RxJS / TypeScript, with a first load under one second.',
    ],
  },
  {
    title: 'Frontend Developer',
    company: 'Raccoon Gang',
    location: 'Kharkiv, Ukraine',
    dates: '2015 - 2018',
    highlights: [
      'Customised the OpenEdX platform for online learning clients, delivering hundreds of tailored EdX environments.',
      'Implemented automated end-to-end testing with Selenium, halving manual testing effort.',
    ],
  },
  {
    title: 'Front End Developer',
    company: 'Webholder',
    location: 'Ukraine',
    dates: '2012 - 2015',
    highlights: ['Delivered HTML and CSS markup for a tailoring management platform.'],
  },
];

export const SKILLS: SkillGroup[] = [
  { area: 'Languages', items: 'TypeScript, JavaScript, Java, Python, PHP, SQL, HTML5, SCSS/CSS' },
  {
    area: 'Front End',
    items:
      'Angular 1-22, Angular Material, Angular Signals, RxJS, NgRx, Nx monorepo, React, Next.js, Ionic, Capacitor, Tailwind CSS, PWA / Service Workers',
  },
  {
    area: 'Back End',
    items:
      'Java 25, Spring Boot 4, Spring Data JPA / Hibernate, REST API design, OAuth2 / JWT, Python 3.13, Django 6, PHP 8 / Symfony, NestJS, Flyway, PostgreSQL, MySQL / MariaDB',
  },
  {
    area: 'Cloud & DevOps',
    items: 'AWS (S3, SQS, SNS, SES), Docker, Docker Compose, Nginx, Terraform, Firebase, Fastlane',
  },
  {
    area: 'Testing & Quality',
    items:
      'Playwright (E2E + visual regression), Vitest, Jest, Jasmine / Karma, Cypress, pytest, PHPUnit, JUnit, SonarCloud, Snyk, OWASP Dependency-Check',
  },
  { area: 'CI/CD', items: 'Bitbucket Pipelines, GitLab CI, GitHub Actions, Azure DevOps, Jenkins' },
  {
    area: 'AI-Assisted Engineering',
    items:
      'Agentic coding workflows (Claude Code), hand-authored agent skills, ticket-to-pull-request automation, agent-driven TDD loops, automated E2E verification, MCP integrations, prompt and context engineering',
  },
  {
    area: 'Integrations',
    items:
      'Azure AD / Entra ID SSO (MSAL), SCIM 2.0, Stripe, PayPal, Apple In-App Purchase, Google Tag Manager / GA4, Datadog, Google Genkit',
  },
  {
    area: 'Domains',
    items:
      'Aviation data & IATA NDC standards, cloud data protection, financial settlement, EdTech, HIPAA-compliant healthcare',
  },
];

export const EDUCATION: string[] = [
  "Master's Degree, Business Management - National Kharkiv Polytechnic University - 1998 - 2004",
  "Master's Degree, Jurisprudence - Kharkiv National University of Internal Affairs - 1998 - 2004",
  'HIPAA Certification - 2018 - 2019',
  'Angular / Django Full-Stack Development - Udemy - 2020',
];
