'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildReservationConfirmed, buildPaymentSucceeded } from '@/lib/notify/templates';

function sanitize(v: unknown) {
  return v === null || v === undefined ? '' : String(v);
}

export default function EmailPreviewPage() {
  const sp = useSearchParams();

  // 必須/任意パラメータを取得
  const type = (sp.get('type') ?? 'confirmed').toLowerCase(); // confirmed | payment
  const vars = {
    reservationId: sanitize(sp.get('reservationId') ?? 'abc123'),
    customerName: sanitize(sp.get('customerName') ?? 'テスト太郎'),
    date: sanitize(sp.get('date') ?? '2025-09-15'),
    slot: sanitize(sp.get('slot') ?? '10:00'),
    amount: sanitize(sp.get('amount') ?? '3000'),
    currency: sanitize(sp.get('currency') ?? 'JPY'),
  };

  // テンプレ適用
  const built = useMemo(() => {
    if (type === 'payment') {
      return buildPaymentSucceeded(vars);
    }
    return buildReservationConfirmed(vars);
  }, [type, sp]); // sp が変わったら再計算

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>Email Preview ({type})</h1>

      <p style={{ marginBottom: 8 }}>
        <a href="/dev/email-preview?type=confirmed&reservationId=abc123&customerName=テスト太郎&date=2025-09-15&slot=10:00">
          予約確認テンプレを見る
        </a>
        {' / '}
        <a href="/dev/email-preview?type=payment&reservationId=abc123&amount=3000&currency=JPY">
          決済完了テンプレを見る
        </a>
      </p>

      <h2>Subject</h2>
      <pre style={{ background: '#f6f7f9', padding: 12, borderRadius: 8 }}>{built.subject}</pre>

      <h2>Text</h2>
      <pre style={{ background: '#f6f7f9', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
        {built.text}
      </pre>

      <h2>HTML</h2>
      <div
        style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}
        dangerouslySetInnerHTML={{ __html: built.html }}
      />
    </main>
  );
}
