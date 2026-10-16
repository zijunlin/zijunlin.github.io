import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({ ...base, testMatch: ['game-combat-responsive.spec.js', 'game-combat-edges.spec.js', 'game-combat-details.spec.js'],
  projects: [base.projects[0], { name: 'webkit', use: { browserName: 'webkit' } }],
});
