import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3100';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';

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
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'retain-on-failure',
  },

  // ✅ devサーバに環境変数を明示伝搬（これが無いと /api/checkout が 500→HTML になり得る）
  webServer: {
    command: 'npm run dev -- --port=3100',
    port: 3100,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_BASE_URL: BASE_URL,
      STRIPE_SECRET_KEY,
      STRIPE_PUBLISHABLE_KEY,
      // Next.js が読み込む他の .env があればここへ追記
      NODE_ENV: 'development',
    },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
