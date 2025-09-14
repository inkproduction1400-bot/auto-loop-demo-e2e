// app/dev/email-preview/Client.tsx
'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  buildReservationConfirmed,
  buildPaymentSucceeded,
} from '@/lib/notify/templates';

type Vars = {
  reservationId: string;
  customerName: string;
  date: string;
  slot: string;
  amount: string;
  currency: string;
};

const sanitize = (v: unknown): string => (v == null ? '' : String(v));

export default function EmailPreviewClient() {
  const sp = useSearchParams();

  // searchParams を plain object に
  const spObj = useMemo(() => Object.fromEntries(sp.entries()), [sp]);

  // type を小文字で正規化
  const type = String(spObj.type ?? 'confirmed').toLowerCase(); // 'confirmed' | 'payment'

  // テンプレ変数
  const vars: Vars = useMemo(
    () => ({
      reservationId: sanitize(spObj.reservationId ?? 'abc123'),
      customerName: sanitize(spObj.customerName ?? 'テスト太郎'),
      date: sanitize(spObj.date ?? '2025-09-15'),
      slot: sanitize(spObj.slot ?? '10:00'),
      amount: String(Number(spObj.amount ?? '3000')),
      currency: sanitize(spObj.currency ?? 'JPY'),
    }),
    [spObj]
  );

  // テンプレ適用
  const built = useMemo(
    () => (type === 'payment' ? buildPaymentSucceeded(vars) : buildReservationConfirmed(vars)),
    [type, vars]
  );

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>Email Preview ({type})</h1>

      <p style={{ marginBottom: 8 }}>
        <Link href="/dev/email-preview?type=confirmed&reservationId=abc123&customerName=テスト太郎&date=2025-09-15&slot=10:00">
          予約確認テンプレを見る
        </Link>
        {' / '}
        <Link href="/dev/email-preview?type=payment&reservationId=abc123&amount=3000&currency=JPY">
          決済完了テンプレを見る
        </Link>
      </p>

      <h2>Subject</h2>
      <pre style={{ background: '#f6f7f9', padding: 12, borderRadius: 8 }}>
        {built.subject}
      </pre>

      <h2>Text</h2>
      <pre
        style={{
          background: '#f6f7f9',
          padding: 12,
          borderRadius: 8,
          whiteSpace: 'pre-wrap',
        }}
      >
        {built.text}
      </pre>

      <h2>HTML</h2>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          background: '#fff',
        }}
        // NOTE: テンプレートは自前生成想定（信頼済み）
        dangerouslySetInnerHTML={{ __html: built.html }}
      />
    </main>
  );
}
