# Portfolio

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

**SSR rule.** `ng build` prerenders the page in Node (`outputMode: "static"`), so crawlers, link previews and screen readers get the text before any script runs. Every component therefore also runs on the server:

- Touch browser globals (`window`, `document`, `location`, `matchMedia`, WebGL, `new Date()` for anything shown) only inside `afterNextRender` or behind `isPlatformBrowser`. Anything rendered from them on the server is baked into the HTML at build time (the hero age is set in `afterNextRender` for that reason).
- Chapter builders (`src/app/scene/chapters`) must be synchronous. `SceneEngine.load()` builds the first chapter, drops the loader, then builds one chapter per frame.

## Sound

Silent by default: no `AudioContext` exists until the visitor presses the "Sound" toggle (top left). The choice is kept in `localStorage` (`portfolio.sound`). A remembered "on" shows the toggle pressed, but browsers only let audio start after a user gesture, so it starts on the visitor's first click, tap or key press; scrolling alone doesn't count.

**Soundtrack licence: procedurally generated, original.** `src/app/sound/soundscape.ts` synthesises everything with the Web Audio API; there are no audio files. The mix is a pure function of scroll progress (`src/app/sound/mix.ts`), derived from the war chapter's span, so reverse scrolling retraces it and a changed `scrollWeight` moves it along.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Deployment

Every push to `develop` runs the unit tests, builds with `--base-href /portfolio/` and deploys to GitHub Pages at https://otecmuxah.github.io/portfolio/ (`.github/workflows/deploy.yml`).

**Custom domain later:** add the domain under repo Settings → Pages → Custom domain (GitHub commits a `CNAME` file), point a DNS `CNAME` record at `otecmuxah.github.io`, and change the workflow's `--base-href /portfolio/` to `--base-href /`.

**Link-preview image:** `public/og-image.png` is a 1200×630 still of the hero scene. After changing the hero or its scene, regenerate it with `npm run og-image` (starts the dev server, captures, writes the file) and commit it. The canonical, Open Graph and Twitter tags in `src/index.html` use absolute `https://otecmuxah.github.io/portfolio/` URLs; change them too when a custom domain is added.
