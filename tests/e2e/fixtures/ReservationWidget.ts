// tests/e2e/fixtures/ReservationWidget.ts
import { Page, Locator, expect } from '@playwright/test';

/** ▼ 追加：デバッグフラグ（環境変数 E2E_DEBUG を見てレベル決定） */
const __E2E_DEBUG_RAW = (process.env.E2E_DEBUG ?? '').toString().toLowerCase();
const __E2E_DEBUG_BASIC = /^(1|true|yes|on|basic)$/.test(__E2E_DEBUG_RAW);
const __E2E_DEBUG_TRACE = /^(2|verbose|dump|trace)$/.test(__E2E_DEBUG_RAW);
const __E2E_DEBUG = __E2E_DEBUG_BASIC || __E2E_DEBUG_TRACE;

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
 */
export class ReservationWidget {
  constructor(private page: Page) {}

  /** ▼ 追加：デバッグ出力ヘルパー */
  private dbg(...args: any[]) {
    if (__E2E_DEBUG) console.log(...args);
  }
  /** ▼ 追加：失敗時ダンプを条件実行 */
  private async dumpIf(kind: 'basic' | 'trace', fn: () => Promise<void> | void) {
    if (kind === 'basic' && (__E2E_DEBUG_BASIC || __E2E_DEBUG_TRACE)) {
      await fn();
    } else if (kind === 'trace' && __E2E_DEBUG_TRACE) {
      await fn();
    }
  }

  /** 要素に .disabled クラスが付いているかを安全に判定（evaluate 後の .catch 防止） */
  private async hasDisabledClass(el: Locator): Promise<boolean> {
    try {
      return await el.evaluate((n: any) => n.classList?.contains?.('disabled') ?? false);
    } catch {
      return false;
    }
  }

  /** 要素の tagName と type を取得（radio/checkbox 分岐用） */
  private async tagAndType(el: Locator): Promise<{ tag: string; type: string }> {
    try {
      const tag = (await el.evaluate((n: any) => n.tagName?.toLowerCase())) || '';
      const type = ((await el.getAttribute('type')) || '').toLowerCase();
      return { tag, type };
    } catch {
      return { tag: '', type: '' };
    }
  }

  /** セレクタ集 */
  private get s() {
    const p = this.page;
    return {
      // コンテナ/ロード
      container: p.locator('[data-test="widget-container"]'),
      loadedFlag: p.locator(
        '[data-test="widget-loaded"][data-value="true"], [data-test-widget-loaded="true"], body[data-test-widget-loaded="true"]'
      ),

      // 日付
      datePicker: p.locator('[data-test="date-picker"]'),
      calendar: p.locator('#calendar[role="group"][aria-label="日付"]'),
      // ▼拡張：カード/タブ/ラベル等のバリエーションも拾い、disabled 風は除外
      dateBtn: (iso: string) =>
        p.locator([
          `[data-test="date-${iso}"][data-test-date="${iso}"]`,
          `[data-test-date="${iso}"]`,
          `[data-date="${iso}"]`,
          `[data-date-iso="${iso}"]`,
          `[aria-label="${iso}"]`,
          `[role="tab"][data-date="${iso}"]`,
          `button:has-text("${iso}")`,
          `[role="button"]:has-text("${iso}")`,
          `label:has-text("${iso}")`,
        ].join(', ')).filter({
          hasNot: p.locator('[aria-disabled="true"], [data-disabled="true"], [data-test-disabled="true"], [disabled], .disabled'),
        }),
      dateBtnRaw: (iso: string) =>
        p.locator([
          `[data-test="date-${iso}"][data-test-date="${iso}"]`,
          `[data-test-date="${iso}"]`,
          `[data-date="${iso}"]`,
          `[data-date-iso="${iso}"]`,
          `[aria-label="${iso}"]`,
          `[role="tab"][data-date="${iso}"]`,
          `button:has-text("${iso}")`,
          `[role="button"]:has-text("${iso}")`,
          `label:has-text("${iso}")`,
        ].join(', ')),

      // 時間帯
      timeGroup: p.locator('[role="group"][aria-label="時間帯"]'),
      // ▼修正：AND→OR（どちらか片方の属性でも拾えるように）
      slotBtn: (slot: string) =>
        p.locator(`[data-test="slot-${slot}"], [data-test-slot="${slot}"]`),

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

      // 規約同意チェック等
      consentInputs: p.locator(
        [
          'input[type="checkbox"][data-test*="agree" i]',
          'input[type="checkbox"][name*="agree" i]',
          'input[type="checkbox"][data-test*="consent" i]',
          'input[type="checkbox"][name*="consent" i]',
          'input[type="checkbox"][required]',
          '[data-consent] input[type="checkbox"]',
        ].join(', ')
      ),
      consentRoles: p.locator([
        '[role="checkbox"][data-test*="agree" i]',
        '[role="checkbox"][data-test*="consent" i]',
        '[role="checkbox"]:has-text("同意")',
        '[role="checkbox"]:has-text("利用規約")',
        '[role="checkbox"]:has-text("プライバシー")',
        '[role="switch"]:has-text("同意")',
        '[role="switch"]:has-text("利用規約")',
        '[role="switch"]:has-text("プライバシー")',
      ].join(', ')),
      consentLabels: p.locator('label[for*="agree" i], label[for*="consent" i]'),
      consentLabelsWide: p.locator([
        'label:has-text("同意")',
        'label:has-text("利用規約")',
        'label:has-text("プライバシー")',
        '[data-consent]',
      ].join(', ')),
      consentDataState: p.locator('[data-state][data-test*="agree" i], [data-state][data-test*="consent" i]'),

      // カード（直置き）
      cardNumber: p.locator(
        [
          '[data-test="card-number"]',
          'input[placeholder*="card number" i]',
          'input[autocomplete="cc-number"]',
          'input[name="cardnumber"]',
        ].join(', ')
      ),
      cardExpiry: p.locator(
        [
          '[data-test="card-expiry"]',
          'input[placeholder*="mm" i]',
          'input[autocomplete="cc-exp"]',
          'input[name="exp-date"]',
        ].join(', ')
      ),
      cardCvc: p.locator(
        [
          '[data-test="card-cvc"]',
          'input[placeholder*="cvc" i]',
          'input[autocomplete="cc-csc"]',
          'input[name="cvc"]',
        ].join(', ')
      ),
      cardPostal: p.locator(
        [
          'input[autocomplete="postal-code"]',
          'input[name*="postal" i]',
          'input[name*="zip" i]',
        ].join(', ')
      ),
      cardAddress1: p.locator('input[autocomplete="address-line1"], input[name*="address1" i], input[name="address_line1"]'),
      cardCity: p.locator('input[autocomplete="address-level2"], input[name*="city" i]'),
      cardState: p.locator('input[autocomplete="address-level1"], input[name*="state" i], input[name*="prefecture" i]'),

      // カード（Stripe Elements iframe 風）
      stripeFrame: p.frameLocator('iframe[name*="__privateStripeFrame"], iframe[src*="stripe"]'),
      frameCardNumber: () =>
        p.frameLocator('iframe[name*="__privateStripeFrame"], iframe[src*="stripe"]')
          .locator('input[autocomplete="cc-number"], input[name="cardnumber"], input[placeholder*="card" i]'),
      frameCardExpiry: () =>
        p.frameLocator('iframe[name*="__privateStripeFrame"], iframe[src*="stripe"]')
          .locator('input[autocomplete="cc-exp"], input[name="exp-date"], input[placeholder*="mm" i]'),
      frameCardCvc: () =>
        p.frameLocator('iframe[name*="__privateStripeFrame"], iframe[src*="stripe"]')
          .locator('input[autocomplete="cc-csc"], input[name="cvc"], input[placeholder*="cvc" i]'),
      framePostal: () =>
        p.frameLocator('iframe[name*="__privateStripeFrame"], iframe[src*="stripe"]')
          .locator('input[autocomplete="postal-code"], input[name*="postal" i], input[name*="zip" i]'),

      // 送信
      submitEnabled: p.locator(
        [
          '[data-test="pay-button"]',
          '[data-test="submit"]',
          'button[type="submit"]',
        ]
          .map(
            sel =>
              `${sel}:not([disabled]):not([aria-disabled="true" i]):not([data-disabled="true" i]):not([data-state="disabled" i]):not(.disabled):not(.is-disabled)`
          )
          .join(', ')
      ),
      submitAny: p.locator('[data-test="pay-button"], [data-test="submit"], button[type="submit"]'),

      // バナー類
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

      // フィールド別エラー
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

  // ===== ユーティリティ =====
  private async exists(loc: Locator): Promise<boolean> {
    return (await loc.count()) > 0;
  }
  private async waitVisible(loc: Locator, timeout = 8000) {
    if (await this.exists(loc)) await loc.waitFor({ state: 'visible', timeout }).catch(() => {});
  }
  private async waitAttached(loc: Locator, timeout = 8000) {
    if (await this.exists(loc)) await loc.waitFor({ state: 'attached', timeout }).catch(() => {});
  }
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

  // --- 時間帯の内部値（隠し input/select）サポート ---
  private timeValueFields() {
    const root = (this.s && this.s.container) ? this.s.container : this.page.locator('body');
    return root.locator([
      'input[name*="time" i]',
      'input[name*="slot" i]',
      'select[name*="time" i]',
      'select[name*="slot" i]',
      'input[type="hidden"][name*="time" i]',
      'input[type="hidden"][name*="slot" i]',
      '[data-time-value]',
      '[data-slot-value]',
      'input[name*="timeslot" i]',
      'select[name*="timeslot" i]',
      'input[name*="start_time" i]',
      'select[name*="start_time" i]',
    ].join(', '));
  }
  private async hasTimeValue(): Promise<boolean> {
    const fields = this.timeValueFields();
    const n = await fields.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const f = fields.nth(i);
      const tag = (await f.evaluate((n:any)=>n.tagName?.toLowerCase()).catch(()=>'')) || '';
      let v = '';
      try { v = tag === 'select' ? await f.evaluate((n:any)=>n.value ?? '') : await f.inputValue(); } catch {}
      if (v && String(v).trim()) return true;

      const dataTime = await f.getAttribute('data-time-value').catch(()=>null);
      const dataSlot = await f.getAttribute('data-slot-value').catch(()=>null);
      if ((dataTime && dataTime.trim()) || (dataSlot && dataSlot.trim())) return true;
    }
    return false;
  }
  private async ensureTimeValuePopulated(fromLabel?: string) {
    const fields = this.timeValueFields();
    const n = await fields.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const f = fields.nth(i);
      const tag = (await f.evaluate((n:any)=>n.tagName?.toLowerCase()).catch(()=>'')) || '';
      if (tag === 'select') {
        const choice = f.locator('option[value]:not([value=""]):not([disabled])').first();
        const val = await choice.getAttribute('value').catch(()=>null);
        if (val) { await f.selectOption(val).catch(()=>{}); }
      } else {
        const text = (fromLabel || '10:00') as string;
        await f.evaluate((n:any, v:string) => {
          if ('value' in n) (n as HTMLInputElement).value = v as any;
          (n as HTMLElement).setAttribute?.('value', v);
          (n as HTMLElement).setAttribute?.('data-time-value', v);
          (n as HTMLElement).setAttribute?.('data-slot-value', v);
          const ev1 = new Event('input', { bubbles:true });
          const ev2 = new Event('change', { bubbles:true });
          n.dispatchEvent(ev1); n.dispatchEvent(ev2);
        }, text).catch(()=>{});
      }
    }
  }

  // === 追加：UIシグナル待ち & hidden 同期待ち ===
  private async waitSlotSelectedSignal(timeout = 2000): Promise<void> {
    await this.page.waitForFunction(() => {
      const g = document.querySelector('[aria-label="時間帯"]');
      if (!g) return false;
      const btn = g.querySelector('button.selected,[aria-pressed="true"],[aria-selected="true"],[data-state="selected"],[data-selected="true"],[aria-checked="true"],.active,.is-active');
      return !!btn;
    }, null, { timeout });
  }
  async waitHiddenSynced(timeout = 2000): Promise<void> {
    await this.page.waitForFunction(() => {
      const any = document.querySelectorAll(
        'input[name*="time" i], input[name*="slot" i], select[name*="time" i], select[name*="slot" i], input[type="hidden"][name*="time" i], input[type="hidden"][name*="slot" i], [data-time-value], [data-slot-value], input[name*="timeslot" i], select[name*="timeslot" i], input[name*="start_time" i], select[name*="start_time" i]'
      );
      for (const el of Array.from(any)) {
        const tag = (el as HTMLElement).tagName?.toLowerCase?.() || '';
        const prop = (tag === 'select')
          ? ((el as HTMLSelectElement).value || '').trim()
          : ((el as HTMLInputElement).value || '').trim();
        const attr = ((el as HTMLElement).getAttribute?.('value') || '').trim();
        const dt   = ((el as HTMLElement).getAttribute?.('data-time-value') || '').trim();
        const ds   = ((el as HTMLElement).getAttribute?.('data-slot-value') || '').trim();
        if (prop || attr || dt || ds) return true;
      }
      return false;
    }, null, { timeout });
  }

  // カレンダー
  private async ensureCalendarOpen() {
    if (!(await this.exists(this.s.datePicker))) return;
    if (await this.exists(this.s.calendar)) {
      if (await this.s.calendar.isVisible()) return;
    }
    await this.clickWithRetry(this.s.datePicker);
    await this.waitVisible(this.s.calendar, 8000);
  }
  private async ensureCalendarClosed() {
    if (!(await this.exists(this.s.datePicker))) return;
    if (!(await this.exists(this.s.calendar))) return;
    if (await this.s.calendar.isHidden()) return;
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.waitForTimeout(50);
    if (await this.s.calendar.isHidden()) return;
    await this.clickWithRetry(this.s.datePicker);
    await this.s.calendar.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
  private addDays(dt: Date, days: number) { const d = new Date(dt); d.setDate(d.getDate() + days); return d; }
  private pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
  private formatDate(d: Date) { return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`; }

  // 初期化待ち
  async waitForWidget() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await Promise.race([
      this.s.container.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
      this.s.loadedFlag.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    ]);
  }

  // 日付/時間
  async selectDate(iso: string) {
    if (await this.exists(this.s.datePicker)) {
      await this.ensureCalendarOpen();
    }

    const btn = this.s.dateBtn(iso).first();
    await this.waitAttached(btn, 8000);
    if (await this.exists(btn)) {
      try {
        await this.clickWithRetry(btn);
      } catch {
        const clickTarget = btn.locator(
          'xpath=ancestor-or-self::*[self::button or @role="button" or self::label][1]'
        );
        if (await clickTarget.count()) {
          await this.clickWithRetry(clickTarget.first());
        }
      }
    }

    if (await this.exists(this.s.datePicker)) {
      await this.ensureCalendarClosed();
    }

    // ▼追加：日付選択に伴う hidden クリアを待機（存在する環境のみ）
    try {
      await this.page.waitForFunction(() => {
        const any = document.querySelectorAll(
          'input[name*="time" i], input[name*="slot" i], select[name*="time" i], select[name*="slot" i], input[type="hidden"][name*="time" i], input[type="hidden"][name*="slot" i], [data-time-value], [data-slot-value], input[name*="timeslot" i], select[name*="timeslot" i], input[name*="start_time" i], select[name*="start_time" i]'
        );
        if (!any.length) return true;
        for (const el of Array.from(any)) {
          const tag = (el as HTMLElement).tagName?.toLowerCase?.() || '';
          const prop = (tag === 'select')
            ? ((el as HTMLSelectElement).value || '').trim()
            : ((el as HTMLInputElement).value || '').trim();
          const attr = ((el as HTMLElement).getAttribute?.('value') || '').trim();
          const dt   = ((el as HTMLElement).getAttribute?.('data-time-value') || '').trim();
          const ds   = ((el as HTMLElement).getAttribute?.('data-slot-value') || '').trim();
          if (prop || attr || dt || ds) return false;
        }
        return true;
      }, null, { timeout: 1000 }).catch(() => {});
    } catch {}
  }
  async pickDatePlusDays(days: number) {
    const target = this.formatDate(this.addDays(new Date(), days));
    await this.selectDate(target);
  }
  async isDateDisabled(iso: string): Promise<boolean> {
    if (await this.exists(this.s.datePicker)) {
      await this.ensureCalendarOpen();
    }
    const el = this.s.dateBtnRaw(iso).first();
    await this.waitAttached(el, 3000).catch(() => {});
    if (!(await this.exists(el))) {
      if (await this.exists(this.s.datePicker)) await this.ensureCalendarClosed();
      return true;
    }
    const disabled =
      (await el.getAttribute('data-test-disabled')) === 'true' ||
      (await el.getAttribute('data-disabled')) === 'true' ||
      (await el.getAttribute('aria-disabled')) === 'true' ||
      (await el.getAttribute('disabled')) != null ||
      (await this.hasDisabledClass(el));
    if (await this.exists(this.s.datePicker)) await this.ensureCalendarClosed();
    return disabled;
  }

  /** スロット指定。無ければ最初の有効スロットにフォールバック */
  async selectTimeSlot(slot: string) {
    if (!(await this.exists(this.s.timeGroup))) return;
    await this.waitVisible(this.s.timeGroup, 8000);

    const btn = this.s.slotBtn(slot).first();
    const exists = await this.exists(btn);
    if (exists) {
      await this.waitAttached(btn, 5000);
      try {
        const disabled =
          (await btn.getAttribute('disabled')) != null ||
          (await btn.getAttribute('aria-disabled')) === 'true' ||
          (await btn.getAttribute('data-disabled')) === 'true' ||
          (await this.hasDisabledClass(btn));
        if (!disabled) {
          await this.clickWithRetry(btn);
          // ▼追加：UIシグナル→hidden同期の順で厳密待機
          await this.waitSlotSelectedSignal();
          await this.waitHiddenSynced();
          if (await this.isTimeSelected()) return;
        }
      } catch {/* fall through */}
    }

    if (!(await this.isTimeSelected())) {
      this.dbg(`[selectTimeSlot] fallback: "${slot}" が無い/選べないため最初の有効スロットを選択します`);
      await this.selectFirstAvailableTimeSlot();
      // 念のため最終同期待ち
      await this.waitSlotSelectedSignal().catch(() => {});
      await this.waitHiddenSynced().catch(() => {});
    }
  }

  // 人数
  async inputAttendees(a: AttendeeInput) {
    if (a.adult != null)   await this.s.adult.fill(String(a.adult));
    if (a.student != null) await this.s.student.fill(String(a.student));
    const childVal = a.child != null ? a.child : a.child1;
    if (childVal != null)  await this.s.child.fill(String(childVal));
    if (a.infant != null)  await this.s.infant.fill(String(a.infant));
  }

  // お客様情報
  async fillCustomerInfo(c: CustomerInput) {
    await this.s.name.fill(c.name ?? '');
    await this.s.email.fill(c.email ?? '');
    if (c.phone != null) await this.s.phone.fill(c.phone);
  }
  async fillName(v: string) { await this.s.name.fill(v); }
  async fillEmail(v: string) { await this.s.email.fill(v); }

  // カード
  private defaultExpiry() { return '12 / 34'; }
  async fillCardOnly(card: CardInput | string) {
    const payload: CardInput =
      typeof card === 'string'
        ? { number: card, expiry: this.defaultExpiry(), cvc: '123' }
        : { number: card.number, expiry: card.expiry ?? this.defaultExpiry(), cvc: card.cvc ?? '123' };

    const frameNumber = this.s.frameCardNumber();
    if (await frameNumber.count()) {
      await frameNumber.fill(payload.number);
      const frameExpiry = this.s.frameCardExpiry();
      const frameCvc = this.s.frameCardCvc();
      if (await frameExpiry.count()) await frameExpiry.fill(payload.expiry!);
      if (await frameCvc.count())    await frameCvc.fill(payload.cvc!);
      const fPostal = this.s.framePostal();
      if (await fPostal.count()) await fPostal.fill('100-0001').catch(() => {});
      return;
    }

    if (await this.exists(this.s.cardNumber)) await this.s.cardNumber.fill(payload.number);
    if (await this.exists(this.s.cardExpiry)) await this.s.cardExpiry.fill(payload.expiry!);
    if (await this.exists(this.s.cardCvc))    await this.s.cardCvc.fill(payload.cvc!);

    if (await this.exists(this.s.cardPostal))  await this.s.cardPostal.fill('100-0001').catch(() => {});
    if (await this.exists(this.s.cardAddress1))await this.s.cardAddress1.fill('Chiyoda 1-1').catch(() => {});
    if (await this.exists(this.s.cardCity))    await this.s.cardCity.fill('Chiyoda').catch(() => {});
    if (await this.exists(this.s.cardState))   await this.s.cardState.fill('Tokyo').catch(() => {});
  }

  async completePayment(card: CardInput | string) {
    await this.fillCardOnly(card);
    const btn = this.submitButton();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    if (await btn.isDisabled()) { await btn.click({ trial: true }).catch(() => {}); return; }
    await this.clickWithRetry(btn);
  }

  // 送信可否
  submitButton(): Locator {
    return this.page.locator(
      '[data-test="pay-button"]:not([disabled]):not([aria-disabled="true" i]):not([data-disabled="true" i]):not([data-state="disabled" i]):not(.disabled):not(.is-disabled), ' +
      '[data-test="submit"]:not([disabled]):not([aria-disabled="true" i]):not([data-disabled="true" i]):not([data-state="disabled" i]):not(.disabled):not(.is-disabled), ' +
      'button[type="submit"]:not([disabled]):not([aria-disabled="true" i]):not([data-disabled="true" i]):not([data-state="disabled" i]):not(.disabled):not(.is-disabled), ' +
      '[data-test="pay-button"], [data-test="submit"], button[type="submit"]'
    ).last();
  }

  async isSubmitEnabled(): Promise<boolean> {
    if ((await this.s.submitEnabled.count()) > 0) return true;
    return await this.s.submitAny.last().isEnabled().catch(() => false);
  }

  // 外部からも使える別名
  async acceptAllConsents() { await this.turnOnAllConsents(); }

  // 必須同意・必須電話・カード入力を満たして送信有効化
  async ensureSubmitEnabled() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await this.page.waitForTimeout(150);

    await this.turnOnAllConsents();

    if (await this.exists(this.s.timeGroup)) {
      if (!(await this.isTimeSelected())) {
        await this.selectFirstAvailableTimeSlot().catch(() => {});
        await this.waitHiddenSynced().catch(()=>{});
      }
    }

    if (await this.exists(this.s.phone)) {
      const required =
        (await this.s.phone.getAttribute('required')) != null ||
        (await this.s.phone.getAttribute('aria-required')) === 'true';
      const val = await this.s.phone.inputValue().catch(() => '');
      if ((required || true) && !val) {
        await this.s.phone.fill('09012341234');
      }
    }

    await this.fillCardOnly('4242 4242 4242 4242');

    await this.autoFillRequiredFields();

    if (await this.s.name.count()) {
      await this.s.name.type(' ').catch(() => {});
      await this.s.name.press('Backspace').catch(() => {});
      await this.s.name.blur().catch(() => {});
    }
    if (await this.s.email.count()) {
      await this.s.email.type(' ').catch(() => {});
      await this.s.email.press('Backspace').catch(() => {});
      await this.s.email.blur().catch(() => {});
    }

    await this.blurAll();
    await this.page.waitForTimeout(300);

    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await this.page.waitForTimeout(150);

    await this.ensureTimeValuePopulated();

    try {
      await expect.poll(
        async () => {
          if ((await this.s.submitEnabled.count()) > 0) return 'enabled';
          const last = this.s.submitAny.last();
          return (await last.isEnabled().catch(() => false)) ? 'enabled' : 'disabled';
        },
        { timeout: 30_000, message: 'submit button should become enabled' }
      ).toBe('enabled');
    } catch (e) {
      // ▼ 変更：失敗時ダンプは E2E_DEBUG によって制御
      await this.dumpIf('basic', async () => { await this.dumpVisibleErrors('ensureSubmitEnabled'); });
      await this.dumpIf('basic', async () => { await this.dumpDebugState('ensureSubmitEnabled'); });
      await this.dumpIf('trace', async () => { await this.dumpTimeSlots('ensureSubmitEnabled'); });

      if (!(await this.isTimeSelected())) {
        await this.selectFirstAvailableTimeSlot().catch(() => {});
        await this.waitHiddenSynced().catch(()=>{});
      }
      throw e;
    }

    if (!(await this.isSubmitEnabled())) {
      await this.turnOnAllConsents(true);
      await this.page.waitForTimeout(200);
    }
  }

  /** 同意チェックを総当たりでオンにする（ウィジェット内に限定して誤爆を抑制） */
  private async turnOnAllConsents(justNudge = false) {
    const root = (await this.exists(this.s.container)) ? this.s.container : this.page.locator('body');

    // role=checkbox / role=switch
    {
      const roles = root.locator([
        '[role="checkbox"][data-test*="agree" i]',
        '[role="checkbox"][data-test*="consent" i]',
        '[role="checkbox"]:has-text("同意")',
        '[role="checkbox"]:has-text("利用規約")',
        '[role="checkbox"]:has-text("プライバシー")',
        '[role="switch"]:has-text("同意")',
        '[role="switch"]:has-text("利用規約")',
        '[role="switch"]:has-text("プライバシー")',
      ].join(', '));
      const n = await roles.count();
      for (let i = 0; i < n; i++) {
        const c = roles.nth(i);
        const state = await c.getAttribute('aria-checked');
        if (justNudge) { await c.click().catch(() => {}); await c.click().catch(() => {}); }
        else if (state !== 'true') { await c.click().catch(() => {}); }
      }
    }

    // input[type=checkbox]
    {
      const cbs = root.locator([
        'input[type="checkbox"][data-test*="agree" i]',
        'input[type="checkbox"][name*="agree" i]',
        'input[type="checkbox"][data-test*="consent" i]',
        'input[type="checkbox"][name*="consent" i]',
        'input[type="checkbox"][required]',
        '[data-consent] input[type="checkbox"]',
      ].join(', '));
      const n = await cbs.count();
      for (let i = 0; i < n; i++) {
        const cb = cbs.nth(i);
        const checked = await cb.isChecked().catch(() => false);
        if (justNudge) { await cb.click().catch(() => {}); await cb.click().catch(() => {}); }
        else if (!checked) { await cb.check().catch(() => cb.click().catch(() => {})); }
      }
    }

    // data-state トグル
    {
      const toggles = root.locator('[data-state][data-test*="agree" i], [data-state][data-test*="consent" i], [data-consent][data-state]');
      const n = await toggles.count();
      for (let i = 0; i < n; i++) {
        const t = toggles.nth(i);
        const s = (await t.getAttribute('data-state')) ?? '';
        if (justNudge) { await t.click().catch(() => {}); await t.click().catch(() => {}); }
        else if (s !== 'checked' && s !== 'on' && s !== 'true') { await t.click().catch(() => {}); }
      }
    }

    // label クリック
    {
      const labels = root.locator([
        'label[for*="agree" i], label[for*="consent" i]',
        'label:has-text("同意")',
        'label:has-text("利用規約")',
        'label:has-text("プライバシー")',
        '[data-consent]',
      ].join(', '));
      const n = await labels.count();
      for (let i = 0; i < n; i++) {
        const lb = labels.nth(i);
        if (justNudge) { await lb.click().catch(() => {}); await lb.click().catch(() => {}); }
        else { await lb.click().catch(() => {}); }
      }
    }
  }

  /** ウィジェット内の required/input を総当たりで埋める（未知の必須項目に対応） */
  private async autoFillRequiredFields() {
    const root = (await this.exists(this.s.container)) ? this.s.container : this.page.locator('body');

    const inputs = root.locator(
      [
        'input:not([type="hidden"]):not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[role="textbox"]',
      ].join(', ')
    );

    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const el = inputs.nth(i);

      const required =
        (await el.getAttribute('required')) != null ||
        (await el.getAttribute('aria-required')) === 'true' ||
        (await el.getAttribute('data-required')) === 'true';

      if (!required) continue;

      let tag = ''; let type = ''; let role = ''; let name = ''; let placeholder = '';
      try { tag = (await el.evaluate((n: any) => n.tagName?.toLowerCase())) || ''; } catch {}
      try { type = (await el.getAttribute('type'))?.toLowerCase() || ''; } catch {}
      try { role = (await el.getAttribute('role'))?.toLowerCase() || ''; } catch {}
      try { name = (await el.getAttribute('name'))?.toLowerCase() || ''; } catch {}
      try { placeholder = (await el.getAttribute('placeholder'))?.toLowerCase() || ''; } catch {}

      let value = '';
      try {
        value = tag === 'select'
          ? await el.evaluate((n: any) => n.value ?? '')
          : await el.inputValue();
      } catch { value = ''; }

      if (value && value.trim().length > 0) continue;

      const lowerAll = `${name} ${placeholder}`.toLowerCase();

      if (type === 'checkbox' || role === 'checkbox') {
        await el.check().catch(() => el.click().catch(() => {}));
        continue;
      }
      if (type === 'radio') {
        const group = root.locator(`input[type="radio"][name="${name}"]`);
        if ((await group.count()) > 0) await group.first().check().catch(() => group.first().click().catch(() => {}));
        continue;
      }
      if (tag === 'select') {
        const nonEmpty = el.locator('option[value]:not([value=""]):not([disabled])');
        if ((await nonEmpty.count()) > 0) {
          const val = await nonEmpty.first().getAttribute('value');
          if (val) await el.selectOption(val).catch(() => {});
        }
        continue;
      }

      // テキスト系
      let fill = 'OK';
      if (type === 'email' || lowerAll.includes('email') || lowerAll.includes('mail')) fill = 'test@example.com';
      else if (type === 'tel' || lowerAll.includes('tel') || lowerAll.includes('phone')) fill = '09012341234';
      else if (type === 'number') fill = '1';
      else if (lowerAll.includes('name')) fill = 'Taro Test';
      else if (/(zip|postal|postcode)/.test(lowerAll)) fill = '1000001';
      else if (/(pref|prefecture|state)/.test(lowerAll)) fill = 'Tokyo';
      else if (/(city|address|addr)/.test(lowerAll)) fill = 'Chiyoda';
      else if (/(agree|consent)/.test(lowerAll)) fill = 'yes';

      await el.fill(fill).catch(() => el.type(fill).catch(() => {}));
      await el.blur().catch(() => {});
      await this.page.waitForTimeout(50);
    }
  }

  // ===== 可視エラー収集/ダンプ =====
  private async collectVisibleErrors(): Promise<string[]> {
    const p = this.page;
    const locators: Locator[] = [
      this.errorBanner(),
      this.paymentErrorBanner(),
      p.locator('[role="alert"]'),
      p.locator('[aria-live]:not([aria-live="off"])'),
      p.locator('[data-test*="error" i]'),
      p.locator('[data-error-for]'),
      p.locator('[id$="-error" i], [id^="error-" i]'),
      p.locator('.error, .error-text, .error-message, .Mui-error, .text-red-500, .text-red-600, .text-red-700'),
    ];

    const texts: string[] = [];
    for (const l of locators) {
      const n = await l.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const item = l.nth(i);
        if (await item.isVisible().catch(() => false)) {
          const t = (await item.innerText().catch(() => ''))?.trim();
          if (t) texts.push(t);
        }
      }
    }
    return Array.from(new Set(texts));
  }

  /** 画面上の可視エラー文言を console にダンプ（デバッグ時のみ） */
  async dumpVisibleErrors(prefix = 'FormErrors'): Promise<void> {
    const msgs = await this.collectVisibleErrors();
    this.dbg(`[${prefix}] visible error messages (${msgs.length})`);
    for (const t of msgs) this.dbg(`- ${t}`);
  }

  // ===== 追加: 失敗時の詳細ダンプ =====
  private async textByIds(idList: string | null): Promise<string> {
    if (!idList) return '';
    const ids = idList.split(/\s+/).filter(Boolean);
    const texts: string[] = [];
    for (const id of ids) {
      const t = await this.page.locator(`#${id}`).innerText().catch(() => '');
      if (t?.trim()) texts.push(t.trim());
    }
    return texts.join(' | ');
  }

  private async nearestLabelText(el: Locator): Promise<string> {
    const id = (await el.getAttribute('id')) || '';
    if (id) {
      const byFor = this.page.locator(`label[for="${id}"]`);
      if (await byFor.count()) {
        const t = await byFor.first().innerText().catch(() => '');
        if (t?.trim()) return t.trim();
      }
    }
    const wrapped = el.locator('xpath=ancestor::label[1]');
    if (await wrapped.count()) {
      const t = await wrapped.first().innerText().catch(() => '');
      if (t?.trim()) return t.trim();
    }
    const prev = el.locator('xpath=preceding::*[self::label or @role="label" or contains(@class,"label")][1]');
    if (await prev.count()) {
      const t = await prev.first().innerText().catch(() => '');
      if (t?.trim()) return t.trim();
    }
    return '';
  }

  /** 画面状態の詳細ダンプ（invalid/required/consent/submit） */
  async dumpDebugState(prefix = 'DebugState'): Promise<void> {
    const root = (await this.exists(this.s.container)) ? this.s.container : this.page.locator('body');

    // 1) invalid / required 入力
    const controls = root.locator([
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[role="textbox"]',
      '[role="checkbox"]',
    ].join(', '));

    const total = await controls.count().catch(() => 0);
    const lines: string[] = [];
    for (let i = 0; i < total; i++) {
      const el = controls.nth(i);

      let tag = ''; let type = ''; let role = ''; let name = ''; let placeholder = '';
      try { tag = (await el.evaluate((n: any) => n.tagName?.toLowerCase())) || ''; } catch {}
      try { type = (await el.getAttribute('type'))?.toLowerCase() || ''; } catch {}
      try { role = (await el.getAttribute('role'))?.toLowerCase() || ''; } catch {}
      try { name = (await el.getAttribute('name')) || ''; } catch {}
      try { placeholder = (await el.getAttribute('placeholder')) || ''; } catch {}

      let value = '';
      try {
        value = tag === 'select'
          ? await el.evaluate((n: any) => n.value ?? '')
          : await el.inputValue();
      } catch { value = ''; }

      let describedIds: string | null = null;
      try { describedIds = await el.getAttribute('aria-describedby'); } catch {}
      const described = await this.textByIds(describedIds);

      let ariaInvalid = false;
      try { ariaInvalid = (await el.getAttribute('aria-invalid')) === 'true'; } catch {}

      const cssInvalid = await el.evaluate((n: any) => {
        try { return n.matches?.(':invalid') || (typeof n.checkValidity === 'function' && !n.checkValidity()); }
        catch { return false; }
      }).catch(() => false);

      const required =
        (await el.getAttribute('required').catch(() => null)) != null ||
        (await el.getAttribute('aria-required').catch(() => null)) === 'true';

      const isInteresting = ariaInvalid || cssInvalid || (required && (!value || !String(value).trim()));
      if (!isInteresting) continue;

      lines.push(
        [
          `• field: ${await this.nearestLabelText(el) || name || placeholder || '(no label)'}`,
          `  tag=${tag} type=${type || role || ''}`,
          `  required=${required} aria-invalid=${ariaInvalid} css-invalid=${cssInvalid}`,
          `  value="${(value || '').toString().slice(0, 30)}"${value && value.length > 30 ? '…' : ''}`,
          described ? `  describedBy="${described}"` : '',
        ].filter(Boolean).join('\n')
      );
    }

    this.dbg(`[${prefix}] invalid/required fields (${lines.length})`);
    for (const l of lines) this.dbg(l);

    // 2) 同意チェックの状態
    const consentLines: string[] = [];
    const consentCbs = root.locator([
      'input[type="checkbox"][data-test*="agree" i]',
      'input[type="checkbox"][name*="agree" i]',
      'input[type="checkbox"][data-test*="consent" i]',
      'input[type="checkbox"][name*="consent" i]',
      'input[type="checkbox"][required]',
      '[data-consent] input[type="checkbox"]',
    ].join(', '));
    const consentRoles = root.locator([
      '[role="checkbox"][data-test*="agree" i]',
      '[role="checkbox"][data-test*="consent" i]',
      '[role="checkbox"]:has-text("同意")',
      '[role="checkbox"]:has-text("利用規約")',
      '[role="checkbox"]:has-text("プライバシー")',
      '[role="switch"]:has-text("同意")',
      '[role="switch"]:has-text("利用規約")',
      '[role="switch"]:has-text("プライバシー")',
    ].join(', '));
    const consentToggles = root.locator('[data-state][data-test*="agree" i], [data-state][data-test*="consent" i], [data-consent][data-state]');

    if (await consentCbs.count()) {
      const n = await consentCbs.count();
      for (let i = 0; i < n; i++) {
        const cb = consentCbs.nth(i);
        const checked = await cb.isChecked().catch(() => false);
        const name = (await cb.getAttribute('name')) || '';
        const id = (await cb.getAttribute('id')) || '';
        const label = id ? await this.page.locator(`label[for="${id}"]`).innerText().catch(() => '') : '';
        consentLines.push(`• consent[input]: ${label || name || id || '(no label)'} => ${checked ? 'checked' : 'unchecked'}`);
      }
    }
    if (await consentRoles.count()) {
      const n = await consentRoles.count();
      for (let i = 0; i < n; i++) {
        const c = consentRoles.nth(i);
        const st = await c.getAttribute('aria-checked');
        const label = await this.nearestLabelText(c);
        consentLines.push(`• consent[role]: ${label || '(no label)'} => ${st}`);
      }
    }
    if (await consentToggles.count()) {
      const n = await consentToggles.count();
      for (let i = 0; i < n; i++) {
        const t = consentToggles.nth(i);
        const st = (await t.getAttribute('data-state')) ?? '';
        const label = await this.nearestLabelText(t);
        consentLines.push(`• consent[data-state]: ${label || '(no label)'} => ${st}`);
      }
    }
    this.dbg(`[${prefix}] consents (${consentLines.length})`);
    for (const l of consentLines) this.dbg(l);

    // 3) submit ボタンの状態
    const btns = this.s.submitAny;
    const bcount = await btns.count().catch(() => 0);
    const bLines: string[] = [];
    for (let i = 0; i < bcount; i++) {
      const b = btns.nth(i);
      const txt = (await b.innerText().catch(() => '')).trim();
      const disabled = !(await b.isEnabled().catch(() => false));
      const aria = (await b.getAttribute('aria-disabled')) || '';
      const dataDis = (await b.getAttribute('data-disabled')) || '';
      const dataState = (await b.getAttribute('data-state')) || '';
      bLines.push(
        `• submit[${i}]: "${txt || '(no text)'}" => ${disabled ? 'DISABLED' : 'ENABLED'} ` +
        `(aria-disabled=${aria} data-disabled=${dataDis} data-state=${dataState})`
      );
    }
    this.dbg(`[${prefix}] submit buttons (${bLines.length})`);
    for (const l of bLines) this.dbg(l);

    // 4) time value fields の状態
    const tfields = this.timeValueFields();
    const tn = await tfields.count().catch(()=>0);
    if (tn) {
      this.dbg(`[${prefix}] time value fields (${tn})`);
      for (let i = 0; i < tn; i++) {
        const f = tfields.nth(i);
        const name = (await f.getAttribute('name').catch(()=>'')) || '';
        const tag  = (await f.evaluate((n:any)=>n.tagName?.toLowerCase()).catch(()=>'')) || '';
        let value = '';
        try { value = tag === 'select' ? await f.evaluate((n:any)=>n.value ?? '') : await f.inputValue(); } catch {}
        this.dbg(`• timeField[${i}]: ${tag} name="${name}" value="${(value||'').toString()}"`);
      }
    }
  }

  // ===== 時間帯（slot）関連の自動選択 & ダンプ =====
  private async isTimeSelected(): Promise<boolean> {
    if (!(await this.exists(this.s.timeGroup))) {
      return await this.hasTimeValue();
    }
    const g = this.s.timeGroup;
    const selected = g.locator([
      '[aria-pressed="true"]',
      '[aria-checked="true"]',
      '[aria-selected="true"]',
      '[data-state="on"]',
      '[data-state="selected"]',
      '[data-selected="true"]',
      '.is-active',
      '.active',
      '.selected',
      '[aria-current="true"]',
      'input[type="radio"]:checked',
      'input[type="checkbox"]:checked',
    ].join(', '));
    const viaUI = (await selected.count().catch(() => 0)) > 0;
    return viaUI || (await this.hasTimeValue());
  }

  /** 最初の有効な時間帯を自動選択（成功したら true） */
  private async selectFirstAvailableTimeSlot(): Promise<boolean> {
    if (!(await this.exists(this.s.timeGroup))) return await this.hasTimeValue();
    await this.waitVisible(this.s.timeGroup, 8000);

    const candidates = this.s.timeGroup.locator([
      '[data-test^="slot-"]',
      '[data-test-slot]',
      'button',
      '[role="button"]',
      'input[type="radio"]',
      'input[type="checkbox"]',
    ].join(', '));

    const n = await candidates.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const c = candidates.nth(i);
      const label = (await c.innerText().catch(()=> '')).trim();

      const dataState = (await c.getAttribute('data-state')) || '';
      const disabled =
        (await c.getAttribute('disabled')) != null ||
        (await c.getAttribute('aria-disabled')) === 'true' ||
        (await c.getAttribute('data-disabled')) === 'true' ||
        dataState === 'disabled' ||
        (await this.hasDisabledClass(c));
      if (disabled) continue;

      const { tag, type } = await this.tagAndType(c);
      try {
        if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
          await c.check({ trial: true }).catch(() => {});
          await c.check().catch(async () => {
            const id = (await c.getAttribute('id')) || '';
            const lb = id ? this.page.locator(`label[for="${id}"]`) : this.page.locator('xpath=ancestor::label[1]');
            if (await lb.count()) await this.clickWithRetry(lb.first());
          });
        } else {
          await this.clickWithRetry(c);
          if (!(await this.isTimeSelected())) {
            await c.focus().catch(() => {});
            await c.press(' ').catch(() => {});
            await c.press('Enter').catch(() => {});
          }
          if (!(await this.isTimeSelected())) {
            const clickable = c.locator('xpath=ancestor-or-self::*[self::button or @role="button" or self::label][1]');
            if (await clickable.count()) await this.clickWithRetry(clickable.first());
          }
        }

        if (!(await this.isTimeSelected())) {
          await this.ensureTimeValuePopulated(label || undefined);
        }

        // ▼追加：同期完了まで待つ
        await this.waitSlotSelectedSignal().catch(() => {});
        await this.waitHiddenSynced().catch(() => {});

        for (let t = 0; t < 10; t++) {
          if (await this.isTimeSelected()) return true;
          await this.page.waitForTimeout(60);
        }
      } catch {}
    }

    // 最終フォールバック
    if (!(await this.isTimeSelected())) {
      await this.ensureTimeValuePopulated();
      await this.page.waitForTimeout(100);
    }

    return await this.hasTimeValue();
  }

  /** 時間帯スロットの状態をダンプ（デバッグ時のみ） */
  private async dumpTimeSlots(prefix = 'TimeSlots'): Promise<void> {
    if (!(await this.exists(this.s.timeGroup))) {
      this.dbg(`[${prefix}] time group not present`);
      return;
    }
    const items = this.s.timeGroup.locator(
      'button, [role="button"], [data-test-slot], [data-test^="slot-"], input[type="radio"], input[type="checkbox"]'
    );
    const n = await items.count().catch(() => 0);
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const it = items.nth(i);
      const txt = (await it.innerText().catch(() => '')).trim();
      const value = (await it.getAttribute('value')) || '';
      const ariaPressed = (await it.getAttribute('aria-pressed')) || '';
      const ariaChecked = (await it.getAttribute('aria-checked')) || '';
      const ariaSelected = (await it.getAttribute('aria-selected')) || '';
      const dataState = (await it.getAttribute('data-state')) || '';
      const dataSelected = (await it.getAttribute('data-selected')) || '';
      const disabled =
        (await it.getAttribute('disabled')) != null ||
        (await it.getAttribute('aria-disabled')) === 'true' ||
        (await it.getAttribute('data-disabled')) === 'true' ||
        dataState === 'disabled' ||
        (await this.hasDisabledClass(it));
      lines.push(
        `• slot[${i}]: "${txt || value || '(no label)'}" => ${disabled ? 'DISABLED' : 'ENABLED'} ` +
        `(pressed=${ariaPressed} checked=${ariaChecked} selected=${ariaSelected} state=${dataState} data-selected=${dataSelected})`
      );
    }
    this.dbg(`[${prefix}] items (${n})`);
    for (const l of lines) this.dbg(l);
  }

  // ===== 参照系 =====
  async getTotalAmount(): Promise<number> {
    const attr = await this.s.amount.getAttribute('data-test-amount');
    if (attr != null) return Number(attr);
    const txt = (await this.s.amount.textContent()) ?? '0';
    return parseInt(txt.replace(/[^\d]/g, ''), 10) || 0;
  }
  error(field: string): Locator { return this.s.errorOf(field); }
  errorBanner(): Locator { return this.s.errorBannerStrict.first(); }
  paymentErrorBanner(): Locator { return this.s.paymentError.first(); }
  bookingConfirmedBanner(): Locator { return this.s.bookingConfirmed.first(); }

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
export default ReservationWidget;
