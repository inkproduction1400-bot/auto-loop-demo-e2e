// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

// E2E 用のデフォルト注入（未設定なら3100）
process.env.PORT = process.env.PORT || '3100';
process.env.NEXT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT}`;
process.env.PW_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
process.env.E2E_STRIPE_MOCK = process.env.E2E_STRIPE_MOCK || '1'; // デフォルトでON

// ▼ 追加: デバッグレベル（0:静か / 1:基本 / 2:詳細）
const E2E_DEBUG_RAW = (process.env.E2E_DEBUG ?? '').toLowerCase();
const E2E_DEBUG_BASIC =
  /^(1|true|yes|on|basic)$/.test(E2E_DEBUG_RAW);
const E2E_DEBUG_TRACE =
  /^(2|trace|verbose|dump)$/.test(E2E_DEBUG_RAW);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // 失敗時アーティファクトの出力先を統一
  outputDir: 'test-results',

  // レポータ（ローカル/CI 両対応）
  reporter: [
    ['list'],                                  // 標準出力
    ['junit', { outputFile: 'junit.xml' }],    // CI で収集しやすいパスに固定
    ['html', { outputFolder: 'playwright-report', open: 'never' }], // HTML レポート
    ['blob'],                                  // 既存の blob も維持
  ],

  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,

    // ▼ E2E_DEBUG でトレース/スクショ/動画を制御
    //    2: trace=on（常時） / 1: on-first-retry / 0: retain-on-failure
    trace: E2E_DEBUG_TRACE ? 'on' : (E2E_DEBUG_BASIC ? 'on-first-retry' : 'retain-on-failure'),
    //    2 or 1: 失敗時のみスクショ / 0: スクショ無効
    screenshot: (E2E_DEBUG_BASIC || E2E_DEBUG_TRACE) ? 'only-on-failure' : 'off',
    //    2: 常時動画 / それ以外: 失敗時のみ保存
    video: E2E_DEBUG_TRACE ? 'on' : 'retain-on-failure',

    // （任意だが安定化に寄与）
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: 'npm run start:e2e',
    url: process.env.NEXT_PUBLIC_BASE_URL!,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: process.env.PORT!,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL!,
      PW_BASE_URL: process.env.PW_BASE_URL!,
      E2E_STRIPE_MOCK: process.env.E2E_STRIPE_MOCK!,
    },
  },
});
