// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // CI のワークフロー前提（blob + junit）
  reporter: [
    ['blob'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100',
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'retain-on-failure',
    // headless はCIデフォルトで true
  },

  webServer: {
    command: 'npm run dev -- --port=3100',
    port: 3100,
    reuseExistingServer: false, // CI安定化（必ず新規起動）
    timeout: 60_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
