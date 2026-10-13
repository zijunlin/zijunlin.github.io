import { defineConfig } from '@playwright/test';

const managed = process.env.WORKTREE_MANAGED === '1';
const port = managed ? Number(process.env.WORKTREE_PORT) : 4173;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid worktree preview port');
const output = managed ? ' --outDir .scratch/worktree/dist' : '';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  ...(managed ? { outputDir: process.env.WORKTREE_EVIDENCE_DIR } : {}),
  testDir: './tests/browser',
  // Timing and rendered-image checks share the software GPU on test machines.
  workers: 1,
  // Scene readiness includes asynchronous GPU shader preparation.
  expect: { timeout: 15000 },
  use: { locale: 'zh-CN', baseURL, viewport: { width: 1280, height: 800 } },
  projects: [{ name: 'chromium', use: { channel: 'chrome', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } }],
  webServer: {
    command: `npm run build --${output} && npm run preview --${output} --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
