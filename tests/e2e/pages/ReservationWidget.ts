// tests/e2e/pages/ReservationWidget.ts
import { Page } from '@playwright/test';

export interface AttendeeInput {
  adult?: number;
  student?: number;
  child?: number;
  infant?: number;
}

export interface CustomerInput {
  name: string;
  email: string;
  phone: string;
}

export class ReservationWidget {
  constructor(private page: Page) {}

  // Widgetの初期表示を待つ（どちらのデータ属性でもOK）
  async waitForWidget() {
    await this.page.waitForSelector(
      '[data-test="widget-container"], [data-test-widget-loaded="true"]',
    );
  }

  async selectDate(date: string) {
    // date-picker の表記ゆれを吸収
    await this.page.locator(
      '[data-test="date-picker"], [data-test-date-picker]',
    ).click();

    // date セルの表記ゆれを吸収
    await this.page.locator(
      `[data-test="date-${date}"], [data-test-date="${date}"]`,
    ).click();
  }

  async selectTimeSlot(time: string) {
    // slot の表記ゆれを吸収
    await this.page.locator(
      `[data-test="slot-${time}"], [data-test-slot="${time}"]`,
    ).click();
  }

  async inputAttendees(attendees: AttendeeInput) {
    if (attendees.adult !== undefined) {
      await this.page.locator('[data-test-adult-count]').fill(String(attendees.adult));
    }
    if (attendees.student !== undefined) {
      await this.page.locator('[data-test-student-count]').fill(String(attendees.student));
    }
    if (attendees.child !== undefined) {
      await this.page.locator('[data-test-child-count]').fill(String(attendees.child));
    }
    if (attendees.infant !== undefined) {
      await this.page.locator('[data-test-infant-count]').fill(String(attendees.infant));
    }
  }

  async fillCustomerInfo(customer: CustomerInput) {
    await this.page.locator('[data-test-customer-name]').fill(customer.name);
    await this.page.locator('[data-test-customer-email]').fill(customer.email);
    await this.page.locator('[data-test-customer-phone]').fill(customer.phone);
  }

  async completePayment(cardNumber: string = '4242424242424242') {
    await this.page.locator('[data-test-card-number]').fill(cardNumber);
    await this.page.locator('[data-test-card-expiry]').fill('12/25');
    await this.page.locator('[data-test-card-cvc]').fill('123');
    await this.page.locator(
      '[data-test="pay-button"], [data-test-pay-button]',
    ).click();
  }

  async getConfirmationMessage() {
    return await this.page
      .locator(
        '[data-test="reservation-complete"], [data-test-reservation-complete], [data-test="booking-confirmed"]',
      )
      .textContent();
  }

  async getErrorMessage() {
    return await this.page
      .locator('[data-test="error-message"], [data-test-error-message]')
      .textContent();
  }

  async getTotalAmount() {
    // data-test-amount 属性 or テキストから数値を取得
    const el = this.page.locator('[data-test="amount"], [data-test-amount]');
    const attr = await el.getAttribute('data-test-amount');
    if (attr) return parseInt(attr, 10);

    const text = (await el.first().textContent()) ?? '';
    const m = text.replace(/[,¥\s]/g, '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  async isDateDisabled(date: string) {
    const el = this.page.locator(
      `[data-test="date-${date}"], [data-test-date="${date}"]`,
    );
    const v1 = await el.getAttribute('data-test-disabled');
    const v2 = await el.getAttribute('data-test-date-disabled');
    return v1 === 'true' || v2 === 'true';
  }
}
