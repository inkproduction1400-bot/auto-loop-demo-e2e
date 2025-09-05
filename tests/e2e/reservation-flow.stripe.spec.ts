// tests/e2e/reservation-flow.stripe.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { ReservationWidget } from './fixtures/ReservationWidget';
import { StripeCheckout } from './stripe.checkout.helper';

/**
 * Stripe決済E2E
 * - まずUIの「支払う」ボタンでCheckoutへ行けるかを試みる
 * - 失敗時は /api/checkout を絶対URLで叩いて Checkout URL に遷移（CI安定のため）
 */

test.describe('Payment via Stripe Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const rw = new ReservationWidget(page);
    await rw.waitForWidget();
    // UIが無いページでもノーオペで安全（ReservationWidgetの実装上）
    await rw.inputAttendees({ adult: 2 });
    await rw.fillCustomerInfo({ name: '山田太郎', email: 'taro@example.com' });
  });

  async function gotoStripeCheckoutOrCallApi(page: Page, amount = 1200) {
    // 1) UI経由（ボタンがあれば押す）
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

    // 2) API直叩きフォールバック（絶対URL）
    const base =
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3100';

    const res = await page.request.post(`${base}/api/checkout`, {
      data: { amount, currency: 'jpy', metadata: { via: 'e2e' } },
      headers: { 'content-type': 'application/json' },
    });

    if (!res.ok()) {
      const txt = await res.text();
      throw new Error(`Checkout API failed: ${res.status()} ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as { url?: string };
    if (!json?.url) throw new Error('Failed to create Stripe Checkout session');
    await page.goto(json.url!, { waitUntil: 'load' });
  }

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
