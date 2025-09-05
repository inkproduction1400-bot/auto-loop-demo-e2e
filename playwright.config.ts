// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  /* 並列実行がUIレースを誘発するため直列化 */
  workers: 1,
  /* CIで余裕を持たせる */
  timeout: 90_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['blob',  { outputDir: 'blob-report' }],
  ],
  use: {
    baseURL: 'http://localhost:3100',
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port=3100',
    port: 3100,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
