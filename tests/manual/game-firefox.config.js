import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import base from '../../playwright.config.js';
// Run against an already built preview; never rebuild a server used by another check.
export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL('../browser', import.meta.url)),
  webServer: undefined,
  projects: [{ name: 'firefox', use: { browserName: 'firefox' } }],
  outputDir: '../../.scratch/home-space-game-build/firefox-output',
});
