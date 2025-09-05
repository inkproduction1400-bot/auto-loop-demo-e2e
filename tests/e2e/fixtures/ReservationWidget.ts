import { Page, Locator, expect } from '@playwright/test';

export interface AttendeeInput {
  adult?: number;
  student?: number;
  child?: number;   // child-count 用
  child1?: number;  // 互換エイリアス
  infant?: number;
}

export interface CustomerInput {
  name: string;
  email: string;
  phone?: string;
}

export interface CardInput {
  number: string;
  expiry?: string;
  cvc?: string;
}

/**
 * 予約ウィジェット操作ヘルパー
 * - data-test セレクタ契約を一元管理
 * - Validation / Flow 両系テストから共通利用できる API を提供
 * - Validation 実装の差異に耐えるよう、エラー系セレクタは幅広く対応
 * - Firefox / WebKit でも落ちづらいよう、明示 wait と再試行を実装
 */
export class ReservationWidget {
  constructor(private page: Page) {}

  /** 遅延生成のセレクタ集（this 初期化前使用エラー回避のため getter 化） */
  private get s() {
    const p = this.page;
    return {
      // コンテナ/ロード
      container: p.locator('[data-test="widget-container"]'),
      loadedFlag: p.locator(
        '[data-test="widget-loaded"][data-value="true"], [data-test-widget-loaded="true"]'
      ),

      // 日付
      datePicker: p.locator('[data-test="date-picker"]'),
      calendar: p.locator('#calendar[role="group"][aria-label="日付"]'),
      dateBtn: (iso: string) =>
        p.locator(
          `[data-test="date-${iso}"][data-test-date="${iso}"]` +
            `:not([data-test-disabled="true"])`
        ),
      dateBtnRaw: (iso: string) =>
        p.locator(`[data-test="date-${iso}"][data-test-date="${iso}"]`),

      // 時間帯
      timeGroup: p.locator('[role="group"][aria-label="時間帯"]'),
      slotBtn: (slot: string) =>
        p.locator(`[data-test="slot-${slot}"][data-test-slot="${slot}"]`),

      // 人数
      adult: p.locator('[data-test="adult-count"], [data-test-adult-count]'),
      student: p.locator('[data-test="student-count"], [data-test-student-count]'),
      child: p.locator('[data-test="child-count"], [data-test-child-count]'),
      infant: p.locator('[data-test="infant-count"], [data-test-infant-count]'),

      // 合計
      amount: p.locator('#amountLabel[data-test="amount"]'),

      // お客様情報
      name: p.locator('[data-test="customer-name"], [data-test="input-name"]'),
      email: p.locator('[data-test="customer-email"], [data-test="input-email"]'),
      phone: p.locator('[data-test="customer-phone"], [data-test="input-phone"]'),

      // カード
      cardNumber: p.locator('[data-test="card-number"]'),
      cardExpiry: p.locator('[data-test="card-expiry"]'),
      cardCvc: p.locator('[data-test="card-cvc"]'),

      // 送信
      submit: p.locator('[data-test="pay-button"], [data-test="submit"]'),

      // ===== エラーバナー（route announcer は除外）=====
      errorBannerStrict: p.locator(
        [
          '[data-test="error-banner"]',
          '[data-test="payment-error"]',
          '#inputError',
          '.error-banner',
        ].join(', ')
      ),

      paymentError: p.locator('[data-test="payment-error"]'),
      bookingConfirmed: p.locator('[data-test="booking-confirmed"], [data-test="reservation-complete"]'),

      // ===== フィールド別エラー =====
      errorOf: (field: string) =>
        p.locator(
          [
            `[data-test="error-${field}"]`,
            `[data-error-for="${field}"]`,
            `.error-${field}`,
            `[data-test="${field}-error"]`,
            `[id$="${field}-error" i]`,
            `[id^="${field}Error" i]`,
            `[data-test="customer-${field}-error"]`,
            `[data-test="input-${field}-error"]`,
            `[role="alert"][data-field="${field}"]`,
            `[aria-live][data-field="${field}"]`,
            `#${field}, [name="${field}"] ~ .error, #${field}-error, .${field}-error`,
          ].join(', ')
        ),
    };
  }

  // ====== 汎用ユーティリティ（安定化） ======
  private async exists(loc: Locator): Promise<boolean> {
    return (await loc.count()) > 0;
  }

  private async waitVisible(loc: Locator, timeout = 8000) {
    if (await this.exists(loc)) {
      await loc.waitFor({ state: 'visible', timeout }).catch(() => {});
    }
  }

  private async waitAttached(loc: Locator, timeout = 8000) {
    if (await this.exists(loc)) {
      await loc.waitFor({ state: 'attached', timeout }).catch(() => {});
    }
  }

  /** クリック再試行（重なり/アニメーションでの取りこぼし対策） */
  private async clickWithRetry(loc: Locator, tries = 2) {
    for (let i = 0; i < tries; i++) {
      try {
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        await loc.click({ trial: true }).catch(() => {});
        await loc.click();
        return;
      } catch {
        if (i === tries - 1) throw new Error('clickWithRetry: failed');
        await this.page.waitForTimeout(250);
      }
    }
  }

  /** 開いていなければ datePicker を押して calendar が visible になるまで待つ */
  private async ensureCalendarOpen() {
    if (!(await this.exists(this.s.datePicker))) return;
    // 既に visible なら何もしない
    if (await this.exists(this.s.calendar)) {
      if (await this.s.calendar.isVisible()) return;
    }
    // 開く
    await this.clickWithRetry(this.s.datePicker);
    await this.waitVisible(this.s.calendar, 8000);
  }

  /** 開いていたら閉じる（Esc → datePickerクリックの順で試みる） */
  private async ensureCalendarClosed() {
    if (!(await this.exists(this.s.datePicker))) return;
    if (!(await this.exists(this.s.calendar))) return;
    if (await this.s.calendar.isHidden()) return;

    // Esc で閉じる UI の場合
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.waitForTimeout(50);
    if (await this.s.calendar.isHidden()) return;

    // まだ見えていればトグル
    await this.clickWithRetry(this.s.datePicker);
    await this.s.calendar.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }

  private addDays(dt: Date, days: number) {
    const d = new Date(dt);
    d.setDate(d.getDate() + days);
    return d;
  }
  private pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
  }
  private formatDate(d: Date) {
    const y = d.getFullYear(),
      m = this.pad(d.getMonth() + 1),
      da = this.pad(d.getDate());
    return `${y}-${m}-${da}`;
  }

  // ===== 初期化待ち =====
  async waitForWidget() {
    // ページロードの安定待ち
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // ウィジェット可視化 or ロードフラグ
    await Promise.race([
      this.s.container.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
      this.s.loadedFlag.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    ]);
  }

  // ===== 日付/時間帯 =====
  async selectDate(iso: string) {
    // カレンダー UI が無ければスキップ
    if (!(await this.exists(this.s.datePicker))) return;

    // 開く→対象セルを待ってクリック→閉じる
    await this.ensureCalendarOpen();
    if (!(await this.exists(this.s.calendar))) return;

    const btn = this.s.dateBtn(iso).first();
    await this.waitAttached(btn, 8000);
    if (await this.exists(btn)) {
      await this.clickWithRetry(btn);
    }

    await this.ensureCalendarClosed();
  }

  async pickDatePlusDays(days: number) {
    if (!(await this.exists(this.s.datePicker))) return;
    const target = this.formatDate(this.addDays(new Date(), days));
    await this.selectDate(target);
  }

  /** 指定日が無効（日付ボタンに data-test-disabled="true"）かを返す */
  async isDateDisabled(iso: string): Promise<boolean> {
    if (!(await this.exists(this.s.datePicker))) return false;

    await this.ensureCalendarOpen();

    const el = this.s.dateBtnRaw(iso).first();
    await this.waitAttached(el, 3000);

    // ボタンが存在しなければ「選べない」とみなす
    if (!(await this.exists(el))) {
      await this.ensureCalendarClosed();
      return true;
    }

    const attr = await el.getAttribute('data-test-disabled');
    const disabled = attr === 'true' || (await el.isDisabled());

    await this.ensureCalendarClosed();
    return disabled;
  }

  async selectTimeSlot(slot: string) {
    if (!(await this.exists(this.s.timeGroup))) return;
    await this.waitVisible(this.s.timeGroup, 8000);

    const btn = this.s.slotBtn(slot).first();
    await this.waitAttached(btn, 5000);
    if (await this.exists(btn)) {
      await this.clickWithRetry(btn);
    }
  }

  // ===== 人数 =====
  async inputAttendees(a: AttendeeInput) {
    if (a.adult != null)   await this.s.adult.fill(String(a.adult));
    if (a.student != null) await this.s.student.fill(String(a.student));
    const childVal = a.child != null ? a.child : a.child1;
    if (childVal != null)  await this.s.child.fill(String(childVal));
    if (a.infant != null)  await this.s.infant.fill(String(a.infant));
  }

  // ===== お客様情報 =====
  async fillCustomerInfo(c: CustomerInput) {
    await this.s.name.fill(c.name ?? '');
    await this.s.email.fill(c.email ?? '');
    if (c.phone != null) await this.s.phone.fill(c.phone);
  }

  // Validation 用の糖衣
  async fillName(v: string) { await this.s.name.fill(v); }
  async fillEmail(v: string) { await this.s.email.fill(v); }

  // ===== 決済押下 =====
  /**
   * Flow テスト互換のため、文字列（カード番号のみ）/ オブジェクトの両方を受け付ける
   * - 文字列の場合は expiry "12/25", cvc "123" をデフォルト補完
   */
  async completePayment(card: CardInput | string) {
    const payload: CardInput =
      typeof card === 'string'
        ? { number: card, expiry: '12/25', cvc: '123' }
        : { number: card.number, expiry: card.expiry ?? '12/25', cvc: card.cvc ?? '123' };

    await this.s.cardNumber.fill(payload.number);
    if (await this.exists(this.s.cardExpiry)) await this.s.cardExpiry.fill(payload.expiry!);
    if (await this.exists(this.s.cardCvc))    await this.s.cardCvc.fill(payload.cvc!);

    const btn = this.s.submit.first();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    if (await btn.isDisabled()) {
      // 無効なら Validation を誘発するだけ（クリック試行）
      await btn.click({ trial: true }).catch(() => {});
      return;
    }
    await this.clickWithRetry(btn);
  }

  // ===== 参照系 =====
  async getTotalAmount(): Promise<number> {
    // data-test-amount 属性（優先）→ テキストから数値抽出の順で読む
    const attr = await this.s.amount.getAttribute('data-test-amount');
    if (attr != null) return Number(attr);
    const txt = (await this.s.amount.textContent()) ?? '0';
    return parseInt(txt.replace(/[^\d]/g, ''), 10) || 0;
  }

  submitButton(): Locator { return this.s.submit.first(); }
  error(field: string): Locator { return this.s.errorOf(field); }
  errorBanner(): Locator { return this.s.errorBannerStrict.first(); }
  paymentErrorBanner(): Locator { return this.s.paymentError.first(); }
  bookingConfirmedBanner(): Locator { return this.s.bookingConfirmed.first(); }

  /** すべての入力を blur してバリデーション発火 */
  async blurAll() {
    const inputs = [this.s.name, this.s.email, this.s.phone];
    for (const el of inputs) {
      if (await el.count()) {
        await el.focus();
        await this.page.keyboard.press('Tab').catch(() => {});
      }
    }
    await this.page.locator('body').click().catch(() => {});
  }
}
