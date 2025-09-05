// tests/e2e/stripe.checkout.helper.ts
import { Page, expect } from '@playwright/test';

export class StripeCheckout {
  constructor(private page: Page) {}

  // Stripe Checkout 本体の iframe（タイトルはロケール等で変わるため "Secure" を含むものを狙う）
  private frame() {
    return this.page.frameLocator('iframe[title*="Secure"]');
  }

  async waitForLoaded() {
    await this.frame()
      .locator('input[name="email"], input[autocomplete="email"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
  }

  async fillEmail(v: string) {
    await this.frame().locator('input[name="email"], input[autocomplete="email"]').first().fill(v);
  }

  async fillCard(number: string, exp: string = '12 / 34', cvc: string = '123', name = 'TARO YAMADA') {
    // フィールド名はUI更新で変わることがあるので複数候補でフォールバック
    await this.frame()
      .locator('input[name="cardnumber"], input[autocomplete="cc-number"]')
      .first()
      .fill(number);
    await this.frame()
      .locator('input[name="exp-date"], input[autocomplete="cc-exp"]')
      .first()
      .fill(exp);
    await this.frame()
      .locator('input[name="cvc"], input[autocomplete="cc-csc"]')
      .first()
      .fill(cvc);

    const nameField = this.frame().locator('input[name="billingName"], input[name="name"]');
    if (await nameField.count()) await nameField.first().fill(name);
  }

  async submitAndWaitResult() {
    // 「支払う / Pay」ボタン（地域によってラベル差分あり）
    await this.frame().getByRole('button', { name: /支払|pay/iu }).click();
    await this.page.waitForURL(/[\?&]paid=(0|1)/, { timeout: 30_000 });
  }

  static CARDS = {
    success: '4242 4242 4242 4242',
    decline: '4000 0000 0000 9995', // 一般的な拒否
    // 3Dセキュア挑戦が必要なカード例（将来使う場合）
    challenge_3ds: '4000 0027 6000 3184',
  };
}
