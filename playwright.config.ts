import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  retries: 0,
  timeout: 30_000,

  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['blob'],
  ],

  // 各ブラウザ
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],

  // Next.js dev server を CI/ローカルで共通起動
  webServer: {
    command: 'npm run dev -- --port=3100',
    port: 3100,
    reuseExistingServer: true,
    timeout: 60_000,
    // ✅ Next サーバへも env を明示注入（CI の job.env と一致）
    env: {
      NEXT_PUBLIC_BASE_URL:
        process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      E2E_STRIPE_MOCK: process.env.E2E_STRIPE_MOCK ?? '1',
    },
  },
});
