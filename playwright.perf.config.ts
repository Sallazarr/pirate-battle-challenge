import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/performance.spec.ts',
  timeout: 270_000,
  expect: { timeout: 15_000 },
  workers: 1,
  outputDir: 'artifacts/performance/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/performance/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: { args: ['--enable-precise-memory-info'] },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
