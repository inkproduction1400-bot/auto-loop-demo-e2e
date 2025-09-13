'use client';

import { useMemo, useState, Suspense, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackUI } from '@/lib/obs/ui';

function last4(card: string) {
  const dig = card.replace(/\D+/g, '');
  return dig.slice(-4) || undefined;
}

function safeBase(): string {
  try {
    return window.location.origin || '';
  } catch {
    return '';
  }
}

function MockCheckoutInner() {
  const sp = useSearchParams();

  const amount = useMemo(() => {
    const n = Number(sp.get('amount') ?? 1000);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 1000;
  }, [sp]);

  const currency = useMemo(
    () => (sp.get('currency') ?? 'jpy').toLowerCase(),
    [sp]
  );

  const presetStatus = sp.get('status'); // "success" | "cancel" | null
  const reservationId = sp.get('reservationId') ?? undefined;

  const [card, setCard] = useState('');
  const [mm, setMm] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  // 画面表示時・パラメータ確定時に記録
  useEffect(() => {
    trackUI('checkout_opened', { amount, currency });
  }, [amount, currency]);

  // API 側が /mock-checkout?status=... を付与してきた時は即時リダイレクト
  useEffect(() => {
    const status = (presetStatus ?? '').toLowerCase();
    if (status === 'success' || status === 'cancel') {
      trackUI('checkout_mock_redirect', { status, amount, currency, reservationId });
      const base = safeBase();
      const url = new URL(base + '/');
      url.searchParams.set('status', status);
      if (reservationId) url.searchParams.set('reservationId', reservationId);
      window.location.replace(url.toString());
    }
  }, [presetStatus, amount, currency, reservationId]);

  const pay = useCallback(() => {
    trackUI('checkout_submit_clicked', {
      amount,
      currency,
      card_last4: last4(card),
    });

    // 4242... → success、4000...0002 → decline（＝cancel扱い）
    const normalized = card.replace(/\s+/g, '');
    const isSuccess = normalized.startsWith('4242');
    const isDecline = normalized.endsWith('0002');

    const status = isDecline ? 'cancel' : isSuccess ? 'success' : 'success';

    // 結果を Breadcrumb に残す（PIIなし）
    trackUI(isDecline ? 'checkout_failed' : 'checkout_succeeded', {
      amount,
      currency,
      card_last4: last4(card),
    });

    const base = safeBase();
    const url = new URL(base + '/');
    url.searchParams.set('status', status);
    if (reservationId) url.searchParams.set('reservationId', reservationId);
    window.location.href = url.toString();
  }, [amount, currency, card, reservationId]);

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pay();
    }
  };

  // API からの即時リダイレクトモードではフォームを描画しない
  if ((presetStatus ?? '').toLowerCase() === 'success' || (presetStatus ?? '').toLowerCase() === 'cancel') {
    return null;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card} role="form" aria-label="Mock Stripe Checkout">
        <h1 style={{ marginTop: 0 }}>Mock Stripe Checkout</h1>
        <p>
          Amount: <b>{currency.toUpperCase()} {amount}</b>
        </p>

        <div style={styles.field}>
          <label htmlFor="cardNumber">Card number</label>
          <input
            id="cardNumber"
            placeholder="Card number"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            onBlur={() => trackUI('card_input_blur', { card_last4: last4(card) })}
            onKeyDown={onKeyDown}
            inputMode="numeric"
            autoComplete="cc-number"
          />
        </div>

        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 1 }}>
            <label htmlFor="mmYY">MM / YY</label>
            <input
              id="mmYY"
              placeholder="MM / YY"
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              onBlur={() => trackUI('mm_yy_input_blur')}
              onKeyDown={onKeyDown}
              inputMode="numeric"
              autoComplete="cc-exp"
            />
          </div>
          <div style={{ width: 12 }} />
          <div style={{ ...styles.field, flex: 1 }}>
            <label htmlFor="cvc">CVC</label>
            <input
              id="cvc"
              placeholder="CVC"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              onBlur={() => trackUI('cvc_input_blur')}
              onKeyDown={onKeyDown}
              inputMode="numeric"
              autoComplete="cc-csc"
            />
          </div>
        </div>

        <div style={styles.field}>
          <label htmlFor="nameOnCard">Name on card</label>
          <input
            id="nameOnCard"
            placeholder="Name on card"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => trackUI('name_input_blur')}
            onKeyDown={onKeyDown}
            autoComplete="cc-name"
          />
        </div>

        <div style={{ height: 12 }} />
        <button style={styles.payBtn} onClick={pay} aria-label="Pay">
          Pay
        </button>
      </div>
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<div>Loading checkout...</div>}>
      <MockCheckoutInner />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    background: '#f5f7fb',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
  },
  card: {
    width: 420,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,.06)',
  },
  field: { display: 'grid', gap: 6 },
  row: { display: 'flex' },
  payBtn: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
