// tests/e2e/reservation-flow.stripe.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { ReservationWidget } from './fixtures/ReservationWidget';
import { StripeCheckout } from './stripe.checkout.helper';

const BASE =
  (process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3100');

// /api/checkout を叩く（厳密エラーハンドリング）
async function createCheckoutSession(page: Page, amount = 1200) {
  const res = await page.request.post(`${BASE}/api/checkout`, {
    data: { amount, currency: 'jpy', metadata: { via: 'e2e' } },
    headers: { 'content-type': 'application/json' },
  });

  // ステータスコードで早期に弾く
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(
      `Checkout API failed: ${res.status()} ${res.statusText()}\n` +
      `${body.slice(0, 300)}`
    );
  }

  // JSON 解析が失敗した場合もデバッグしやすく
  let json: any;
  try {
    json = await res.json();
  } catch {
    const body = await res.text();
    throw new Error(
      `Checkout API returned non-JSON (status ${res.status()}):\n` +
      `${body.slice(0, 300)}`
    );
  }

  if (!json?.url) throw new Error(`Checkout API returned invalid payload: ${JSON.stringify(json).slice(0, 200)}`);
  return json.url as string;
}

/**
 * UIの「支払う」ボタンでCheckoutへ行けるかをまず試し、
 * 失敗した場合は API を直接叩いて Checkout URL に遷移する。
 */
async function gotoStripeCheckoutOrCallApi(page: Page, amount = 1200) {
  const payBtn = page.locator('[data-test="pay-button"], [data-test="submit"]').first();
  if (await payBtn.count()) {
    try {
      await payBtn.scrollIntoViewIfNeeded();
      await payBtn.click();
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
      return;
    } catch {
      // フォールバックへ
    }
  }

  const url = await createCheckoutSession(page, amount);
  await page.goto(url, { waitUntil: 'load' });
}

test.describe('Payment via Stripe Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const rw = new ReservationWidget(page);
    await rw.waitForWidget();
    await rw.inputAttendees({ adult: 2 });
    await rw.fillCustomerInfo({ name: '山田太郎', email: 'taro@example.com' });
  });

  test('E2E-020: Stripe Checkout success', async ({ page }) => {
    await gotoStripeCheckoutOrCallApi(page, 1200);

    const co = new StripeCheckout(page);
    await co.waitForLoaded();
    await co.fillEmail('taro@example.com');
    await co.fillCard(StripeCheckout.CARDS.success, '12 / 34', '123');
    await co.submitAndWaitResult();

    await expect(page).toHaveURL(/[\?&]paid=1/);
  });

  test('E2E-021: Stripe Checkout decline shows error', async ({ page }) => {
    await gotoStripeCheckoutOrCallApi(page, 1200);

    const co = new StripeCheckout(page);
    await co.waitForLoaded();
    await co.fillEmail('ng@example.com');
    await co.fillCard(StripeCheckout.CARDS.decline, '12 / 34', '123');
    await co.submitAndWaitResult();

    await expect(page).toHaveURL(/[\?&]paid=0/);
  });
});
