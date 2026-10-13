import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Portable real-page checks: trusted taps in both engines; detailed multi-touch
// drag/cancel coverage remains in the Chromium CDP mobile suite.
export default defineConfig({
  ...base,
  testMatch: 'game-mobile-engines.spec.js',
  use: { ...base.use, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  projects: [
    base.projects[0],
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
