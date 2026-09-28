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
  workAuthorisation: 'German residence permit',
  availability: '4 weeks - works on contract via own entity',
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

/**
 * On since Mykhailo approved the PDF (#13). `npm run cv:pdf` rewrites
 * public/mykhailo-maliavin-cv.pdf from his CV text; he reviews it again before it's committed.
 */
export const CV_PDF_PUBLISHED = true;
export const CV_PDF_FILE = 'mykhailo-maliavin-cv.pdf';

/** The CV's profile, one entry per paragraph. */
export const CV_SUMMARY: string[] = [
  'Engineering lead with over a decade building highly scalable, performant web applications - Angular and TypeScript on the front end, Java/Spring Boot and Python/Django behind it. Currently leading 6 developers within a 50-person engineering organisation at IATA, delivering the ISAGO audit management platform across an Angular 22 client and six Java 25 / Spring Boot 4 microservices, alongside the public Airline Retailing Maturity Index on Django.',
  'Over the past year I have rebuilt how my team ships. AI agents now carry a ticket from its number to a reviewed pull request - planning, test-first implementation, end-to-end verification and the PR description - running on a skill library I wrote by hand to encode our architecture, testing conventions and definition of done. Review is the human step; authoring largely is not.',
  'Self-taught, and I lead from the front: earlier I founded and architected the front end of a finance learning platform serving 100,000+ users (sub-1s load, sub-200KB bundle) with a team of 5, and built and released its cross-platform mobile app single-handed. I own features the whole way - design, database migration, REST contract, UI, automated test, CI pipeline - and I still write the hard ones myself.',
];

export const ROLES: Role[] = [
  {
    title: 'Senior Full-Stack Developer (Contract)',
    company: 'International Air Transport Association',
    location: 'Geneva, Switzerland (remote)',
    dates: '2024 - Present',
    highlights: [
      'Leading a team of 6 developers within a 50-person engineering organisation, delivering four platforms across aviation operations, certification and finance.',
      'AI-Assisted Delivery: integrated AI agents into the development flow, taking a ticket from its number to an open pull request: the agent plans the change, implements it test-first, runs Playwright end-to-end verification against the running application, and writes the PR description - turning the authoring phase into a review phase and making delivery close to autonomous.',
      'AI-Assisted Delivery: made that output reviewable rather than merely generated: each run also writes the feature documentation, updates the ubiquitous-language files that keep domain terms consistent across the codebase, and saves evidence artefacts - screenshots and request/response transcripts - so a developer can confirm the work was done correctly without repeating it.',
      'AI-Assisted Delivery: wrote the skill library the pipeline runs on - hand-authored, repository-specific instructions encoding architecture, testing conventions, evidence requirements and definition of done - so agent output arrives at the standard a reviewer would otherwise enforce by hand.',
      'ATMPM: built a modern web application using Next.js 15 (App Router), React 18, TypeScript and ShadCN/UI with Tailwind CSS for monitoring and forecasting air traffic management performance, integrating AI-powered analysis via Genkit (Google AI) for anomaly detection and traffic forecasting.',
      'ATMPM: implemented the ATM Benchmark module with interactive Leaflet maps, Key Performance Area detail views with Recharts/Plotly visualisations, an efficiency illustrator with flight plan modelling, and comprehensive user management with Azure MSAL authentication and role-based access control.',
      "AMSS: delivered 138 Jira stories and defects end to end across an Angular 22 enterprise client and six Java 25 / Spring Boot 4 microservices - IATA's platform for running the ISAGO ground-handling certification programme worldwide.",
      'AMSS: owned the modules scheduling managers work in daily: audit requests, auditor profiles, projects and contracts, conflict-of-interest removal workflows, blackout periods, performance records and admin dashboards - with filtering, search and 85%+ test coverage.',
      'AMSS: implemented the auditor pairing lifecycle in the Spring Boot core service - multi-auditor assignment where an audit becomes scheduled only once every remaining pairing confirms, per-auditor declines, and rescheduling triggered by the last decline - replacing a single-auditor assumption running through the entire domain model.',
      'AMSS: corrected the inputs feeding the Google OR-Tools CP-SAT auto-scheduling solver, eliminating false conflicts that were silently excluding available auditors from scheduling runs, and categorised every excluded audit by what actually blocked it - turning an opaque list into a work queue for the scheduling team.',
      "ARM Index: principal engineer on IATA's public Airline Retailing Maturity Index (Django 6 / Python 3.13), the registry where airlines and IT providers publish their NDC capabilities and certifications: 481 commits across models, migrations, admin, views, templates, tests and deployment.",
      'ARM Index: built the Offers & Orders Implementation questionnaire as a full-stack Django module: hierarchical Section > Topic > Question Area > Question structure, five question types including drag-and-drop ranking, 15+ models, object-level permissions via django-guardian, Excel export and a consent-gated public registry.',
      "ARM Index: introduced the project's first automated E2E and visual-regression suite - Playwright with committed baseline images and a Dockerised Chromium runner - wired into every pipeline so layout regressions fail the build instead of reaching production.",
      'ARM Index: hardened the platform: cleared Snyk CVE gates on Django and cryptography, fixed a path-traversal vulnerability in the XSD validation service, and converted destructive admin actions from GET links to CSRF-protected POST.',
      'ASPAC Portal: built accounts-receivable workspaces for seven international stations, plus financial settlement data services, billing and receiving, tax and debt-recovery modules in Angular 20.',
      'ASPAC Portal: delivered multi-step import wizards for bulk financial uploads - per-step validation, resumable state, approval tracking and inline error reporting - replacing manual spreadsheet handovers between finance teams, alongside SAP report retrieval and XLSX export.',
      'ASPAC Portal: held enterprise quality gates: Jasmine/Karma coverage published to SonarCloud and OWASP Dependency-Check running in CI across test, staging and production pipelines.',
    ],
  },
  {
    title: 'Senior Frontend Developer',
    company: 'Ciklum',
    location: 'Kyiv, Ukraine (remote)',
    dates: '2022 - 2024',
    note: 'client engagements below',
    highlights: [
      "Delivered Angular front ends over .NET services to enterprise clients as part of Ciklum's outsourced engineering practice, in a team of 8 working Agile with Azure DevOps - Redstor 2022 - 2023, Deloitte 2023 - 2024.",
    ],
  },
  {
    title: 'Senior Frontend Developer (via Ciklum)',
    company: 'Deloitte',
    location: 'Kyiv, Ukraine (remote)',
    dates: '2023 - 2024',
    highlights: [
      "Angular front-end development over .NET services within Deloitte's POD v5 team, in a team of 8 working Agile with Azure DevOps. Engagement details under NDA.",
      'Migrated the front end to an Nx monorepo with module federation across both client engagements, improving application performance by 40% and letting modules ship independently rather than as one release.',
      'Defined requirements and scoped features to budget with business stakeholders and presented new capability to them directly.',
    ],
  },
  {
    title: 'Lead Frontend Developer (via Ciklum)',
    company: 'Redstor',
    location: 'Kyiv, Ukraine (remote)',
    dates: '2022 - 2023',
    highlights: [
      'Led front-end development on a cloud data-protection platform, Angular over .NET services, in a team of 8 working Agile with Azure DevOps. Engagement details under NDA.',
      'Owned the front-end architecture and the day-to-day direction of the work, running Agile delivery with Azure DevOps alongside .NET service teams.',
    ],
  },
  {
    title: 'Lead Frontend Developer',
    company: 'Corporate Finance Institute',
    location: 'Warsaw, Poland / remote',
    dates: '2020 - 2022',
    highlights: [
      "Founded and architected the front end of Canada's most popular online finance learning platform (100,000+ users) - built from scratch, scaled to an Nx monorepo serving student, admin and B2B applications, holding sub-1s load time and a sub-200KB bundle.",
      "Built the platform's course player - the screen every learner spends their time in - with notes, table of contents, resumable progress, playback state and lesson navigation, plus the surrounding course, programme and bundle experience.",
      'Delivered the learner journey around it - enrolment, learning paths, search, certificates and transcripts, streaks, infinite-scroll catalogues, notifications, guided onboarding tours, dark mode and a B2B account switcher - alongside the shared component library the admin and B2B apps also consumed.',
      'Owned the revenue path end to end on the front end: Stripe and PayPal checkout, subscription upgrade / cancellation / reactivation, coupons and pricing plans, together with the Google Tag Manager / GA4 event layer and referrer attribution the growth team reported on.',
      "Created CFI's cross-platform mobile app from its first commit and shipped it to both stores single-handed - one Angular codebase targeting iOS and Android via Ionic + Capacitor, with Firebase authentication and analytics, Apple In-App Purchase, secure credential storage, offline and network-state handling and video playback, released through a Fastlane pipeline that reduced a manual submission checklist to a single command.",
      'Built the exams platform (Angular, Nx, Tailwind): exam start / auto-start and resume, third-party proctoring integration with graceful fallback when the provider fails mid-exam, anti-cheat lockdown, and results delivery.',
      'Kept the learning platform on a current stack through successive major Angular versions with no feature freeze, across a 133-project Nx workspace with NgRx state and a shared design system.',
      'Worked full-stack in PHP 8 / Symfony on the platform API - Apple Pay feature parameter with data-migration command, coupon prevalidation error handling, two-factor-authentication login response - with controller-level test coverage.',
      'Led a team of 5 as head of the front-end function: defined the architecture and requirements, ran sprint planning and task distribution, demoed to the business, and grew engineers from entry to junior level.',
    ],
  },
  {
    title: 'Javascript Developer, part-time',
    company: 'PENTASOFT',
    location: 'Madrid, Spain (remote)',
    dates: '2021 - 2022',
    note: 'concurrent with the CFI role above',
    highlights: [
      'Built NEURON, an IoT platform giving growers real-time monitoring of sensor networks across farms, greenhouses and crop fields - Angular 12-13 with NGXS state management and a GraphQL API.',
      'Handled continuous sensor telemetry in the client with RxJS stream composition, keeping dashboards responsive under constant inbound data, with unit coverage in Karma.',
    ],
  },
  {
    title: 'Javascript Engineer',
    company: 'TEAM International',
    location: 'Kharkiv, Ukraine',
    dates: '2019 - 2021',
    highlights: [
      'Built VaultMR, a platform for managing rehabilitation clinics, eliminating paper-based workflows across certification-heavy processes including HL7, eRehab and HIPAA compliance, with multi-factor authentication.',
      'Migrated a hybrid AngularJS application to Angular 2+, moving the codebase off a frozen framework and onto a supported release line.',
      'Cut page load time from 25 seconds to 6 through lazy loading of application modules and third-party libraries.',
    ],
  },
  {
    title: 'Javascript Developer',
    company: 'Eastern Peak',
    location: 'Kharkiv, Ukraine',
    dates: '2018 - 2019',
    highlights: [
      'Built FYRE, a restaurant management and delivery CMS in Angular / RxJS / TypeScript - map integration for delivery zones, real-time in-browser table-service notifications, and a first load brought under one second by cutting bundle size.',
    ],
  },
  {
    title: 'Frontend Developer',
    company: 'Raccoon Gang',
    location: 'Kharkiv, Ukraine',
    dates: '2015 - 2018',
    highlights: [
      'Customised the OpenEdX platform for online learning clients, delivering hundreds of tailored EdX environments - including Microsoft Cloud Society and Harvard DART - and converting an existing application into an SPA using Django and vanilla JavaScript.',
      'Implemented automated end-to-end testing with Selenium, halving manual testing effort.',
      'Built the company website from scratch to a sub-1-second first paint, and ran regular JavaScript training sessions for colleagues and newcomers.',
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
