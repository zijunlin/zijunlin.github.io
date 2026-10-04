import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  // Timing and rendered-image checks share the software GPU on test machines.
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1280, height: 800 } },
  projects: [{ name: 'chromium', use: { channel: 'chrome', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } }],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
