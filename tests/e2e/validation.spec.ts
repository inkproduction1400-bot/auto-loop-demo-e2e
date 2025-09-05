import { test, expect } from '@playwright/test';
import { ReservationWidget } from './fixtures/ReservationWidget';

test.describe('Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('空欄では予約できない', async ({ page }) => {
    const w = new ReservationWidget(page);
    // 必要なら日付だけ選ぶ（先頭有効日にフォールバックする実装でもOK）
    await w.pickDatePlusDays(7);

    // 入力を空にしてバリデーション発火
    await w.fillName('');
    await w.fillEmail('');
    await w.blurAll();

    // 氏名エラー（必須）は表示、メールは氏名未入力の間は非表示
    await expect(w.error('name')).toHaveText(/必須/);
    await expect(w.error('email')).toHaveCount(1); // 要素は存在
    await expect(w.error('email')).toBeHidden();   // ただしこの段階では非表示

    // 送信ボタンは無効
    await expect(w.submitButton()).toBeDisabled();

    // 入力エラーバナー
    await expect(w.errorBanner()).toBeVisible();
    await expect(w.errorBanner()).toContainText(/入力に誤り/);
  });

  test('メール形式エラー', async ({ page }) => {
    const w = new ReservationWidget(page);

    // 氏名はOK、メールだけ形式NG
    await w.fillName('太郎');
    await w.fillEmail('invalid-email');
    await w.pickDatePlusDays(7);
    await w.blurAll();

    // フィールド別エラーを直接確認
    await expect(w.error('email')).toBeVisible();
    await expect(w.error('email')).toHaveText(/メール形式エラー/);

    // 送信ボタンは無効
    await expect(w.submitButton()).toBeDisabled();

    // バナーは「入力に誤りがあります」
    await expect(w.errorBanner()).toBeVisible();
    await expect(w.errorBanner()).toContainText(/入力に誤り/);
  });

  test('エラーメッセージUI', async ({ page }) => {
    const w = new ReservationWidget(page);
    await w.fillName('');
    await w.fillEmail('');
    await w.blurAll(); // フォーカスアウトでエラー表示

    await expect(w.errorBanner()).toBeVisible();
    await expect(w.errorBanner()).toContainText('入力に誤り');
  });
});
