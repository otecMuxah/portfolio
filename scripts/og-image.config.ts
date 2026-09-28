import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// `npm run og-image` renders the hero and saves public/og-image.png, the link-preview still.
export default defineConfig({ ...base, testDir: '.', testMatch: 'og-image.ts' });
