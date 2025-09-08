// tests/e2e/reservation-flow.stripe.spec.ts
import { test, expect, Page } from '@playwright/test';
import { ReservationWidget } from './fixtures/ReservationWidget'; // ← named import（未使用なら削除してもOK）

const BASE =
  process.env.PW_BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  'http://127.0.0.1:3100';

async function runStripeMock(page: Page, amount: number, outcome: 'success' | 'decline') {
  // API を絶対URLで叩いて、必ずモック画面に遷移
  const res = await page.request.post(`${BASE}/api/checkout`, {
    data: { amount, currency: 'jpy', metadata: { via: 'e2e', outcome } },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.ok(), `Checkout API should return 2xx, got ${res.status()}`).toBeTruthy();
  const { url } = (await res.json()) as { url: string };
  expect(url, 'Checkout API response must contain url').toBeTruthy();

  await page.goto(url);

  // モックUIでカード情報入力
  await page
    .getByPlaceholder('Card number')
    .fill(outcome === 'success' ? '4242 4242 4242 4242' : '4000 0000 0000 0002');
  await page.getByPlaceholder('MM / YY').fill('12 / 34');
  await page.getByPlaceholder('CVC').fill('123');
  const nameField = page.getByPlaceholder(/name on card/i);
  if (await nameField.count()) await nameField.fill('TARO TEST');

  await page.getByRole('button', { name: /pay/i }).click();
}

test.describe('Payment via Stripe Checkout (Mock UI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('E2E-020: Stripe Checkout success', async ({ page }) => {
    await runStripeMock(page, 1000, 'success');
    await page.waitForURL(/payment=success|status=success/, { timeout: 10_000 });
  });

  test('E2E-021: Stripe Checkout decline shows error', async ({ page }) => {
    await runStripeMock(page, 1000, 'decline');
    await page.waitForURL(/payment=declined|status=cancel/, { timeout: 10_000 });
  });
});
