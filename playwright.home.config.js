import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Real native graphics and semantic navigation, including emulated mobile DPR.
export default defineConfig({
  ...base,
  testMatch: ['home-orbs.spec.js', 'home-trails.spec.js', 'celestial.spec.js'],
  projects: [base.projects[0], { name: 'webkit', use: { browserName: 'webkit' } }],
});
