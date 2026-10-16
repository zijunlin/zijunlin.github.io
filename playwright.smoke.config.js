import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Keep this small gate independent of an open local preview and its dist files.
const baseURL = 'http://127.0.0.1:4178';
export default defineConfig({ ...base,
  outputDir: '.scratch/smoke/results',
  use: { ...base.use, baseURL },
  testMatch: ['game-entry.spec.js', 'game-combat-details.spec.js', 'graphics-recovery.spec.js'],
  grep: /automatically opens once after eligible dwell and loads lazily|fire-rate drop stays visible and native combat continues|real context recovery preserves battle time and waits for explicit resume/,
  projects: [{ name: 'chromium', use: { channel: 'chrome', launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  } } }],
  webServer: {
    command: 'npm run build -- --outDir .scratch/smoke/dist && npm run preview -- --outDir .scratch/smoke/dist --host 127.0.0.1 --port 4178 --strictPort',
    url: baseURL, reuseExistingServer: false,
  },
});
