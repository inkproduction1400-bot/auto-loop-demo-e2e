// app/dev/email-preview/page.tsx
'use client'; // ← クライアント指示は必ず最上部

// このページは常に動的実行（SSG/ISR 無効）
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  buildReservationConfirmed,
  buildPaymentSucceeded,
} from '@/lib/notify/templates';

// ✅ CI や本番で開発用ページを完全無効化したい場合は
//    NEXT_PUBLIC_DISABLE_DEV_ROUTES=1 を環境変数に設定（Actions でも可）
const DISABLED: boolean = process.env.NEXT_PUBLIC_DISABLE_DEV_ROUTES === '1';

type Vars = {
  reservationId: string;
  customerName: string;
  date: string;
  slot: string;
  amount: string;
  currency: string;
};

const toStr = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v);

export default function EmailPreviewPage() {
  // 🚫 無効化フラグ時は即座にトップへ退避（クライアントのみ）
  useEffect(() => {
    if (DISABLED && typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }, []);

  if (DISABLED) {
    // SSR/CSR 両方で安全に「何も描画しない」
    return null;
  }

  const sp = useSearchParams();

  // searchParams を plain object に変換（安定化用）
  const spObj = useMemo<Record<string, string>>(
    () => Object.fromEntries(sp.entries()),
    [sp],
  );

  // type を小文字で正規化
  const type = (spObj.type ?? 'confirmed').toLowerCase(); // confirmed | payment

  // Vars オブジェクト
  const vars = useMemo<Vars>(
    () => ({
      reservationId: toStr(spObj.reservationId ?? 'abc123'),
      customerName: toStr(spObj.customerName ?? 'テスト太郎'),
      date: toStr(spObj.date ?? '2025-09-15'),
      slot: toStr(spObj.slot ?? '10:00'),
      amount: String(Number(spObj.amount ?? '3000')), // 数値化して文字列化
      currency: toStr(spObj.currency ?? 'JPY'),
    }),
    [spObj],
  );

  // テンプレ適用
  const built = useMemo(() => {
    return type === 'payment'
      ? buildPaymentSucceeded(vars)
      : buildReservationConfirmed(vars);
  }, [type, vars]);

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
        // 信頼済みテンプレ出力のみを描画
        dangerouslySetInnerHTML={{ __html: built.html }}
      />
    </main>
  );
}
