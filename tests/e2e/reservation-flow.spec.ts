import { test, expect } from '@playwright/test';
import { ReservationWidget } from './fixtures/ReservationWidget';
import { testData } from './fixtures/testData';

test.describe('Reservation Flow - Normal', () => {
  let widget: ReservationWidget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    widget = new ReservationWidget(page);
    await widget.waitForWidget();
  });

  test('E2E-001: Basic reservation completes', async ({ page }) => {
    await widget.selectDate(testData.dates.tomorrow);
    await widget.selectTimeSlot('14:00-14:30');
    await widget.inputAttendees({ adult: 2 });
    await widget.fillCustomerInfo(testData.customers.valid);
    await widget.completePayment(testData.cards.success);
    await expect(page.locator('[data-test="booking-confirmed"]')).toBeVisible();
  });

  test('E2E-002: Mixed attendees calculates total', async () => {
    await widget.selectDate(testData.dates.tomorrow);
    await widget.selectTimeSlot('14:00-14:30');
    await widget.inputAttendees({ adult: 2, student: 1 });
    const amount = await widget.getTotalAmount();
    expect(amount).toBeGreaterThan(0);
  });

  test('E2E-004: 90 days advance reservation allowed', async ({ page }) => {
    await widget.selectDate(testData.dates.day90Later);
    await widget.selectTimeSlot('14:00-14:30');
    await widget.inputAttendees({ adult: 1 });
    await widget.fillCustomerInfo(testData.customers.valid);
    await widget.completePayment(testData.cards.success);
    await expect(page.locator('[data-test="booking-confirmed"]')).toBeVisible();
  });
});

test.describe('Reservation Flow - Errors', () => {
  let widget: ReservationWidget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    widget = new ReservationWidget(page);
    await widget.waitForWidget();
  });

  test('E2E-008: 91 days advance is disabled', async () => {
    const disabled = await widget.isDateDisabled(testData.dates.day91Later);
    expect(disabled).toBe(true);
  });

  test('E2E-010: Payment decline shows error', async ({ page }) => {
    await widget.selectDate(testData.dates.tomorrow);
    await widget.selectTimeSlot('14:00-14:30');
    await widget.inputAttendees({ adult: 1 });
    await widget.fillCustomerInfo(testData.customers.valid);
    await widget.completePayment(testData.cards.decline);
    // Demoアプリ側の実装差異（data-test属性）に合わせて別名も許容
    const errorLocator = page.locator(
      '[data-test="error-payment-declined"], [data-test="payment-error"], [data-test-payment-error]'
    );
    await expect(errorLocator).toBeVisible({ timeout: 10000 });
  });
});
