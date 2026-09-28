import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/ssr';
import { appConfig } from './app.config';

// Prerendered at build time so crawlers, link previews and screen readers get the text without running the scene.
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
