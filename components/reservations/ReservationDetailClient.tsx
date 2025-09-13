// components/reservations/ReservationDetailClient.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

type ReservationDetail = {
  id: string;
  userId: string;
  date: string;
  slot: string | null;
  adultCount: number;
  studentCount: number;
  childCount: number;
  infantCount: number;
  amount: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; email: string; name: string | null } | null;
};

export default function ReservationDetailClient({ detail }: { detail: ReservationDetail }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const totalParty =
    (detail.adultCount ?? 0) +
    (detail.studentCount ?? 0) +
    (detail.childCount ?? 0) +
    (detail.infantCount ?? 0);

  async function handleCancel() {
    if (submitting) return;
    const reason = window.prompt('キャンセル理由（任意）を入力してくださいで御座る：') ?? '';
    const ok = window.confirm('本当にキャンセルしますかで御座る？');
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reservations/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'cancel', reason }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        alert(`キャンセルに失敗しましたで御座る：${json?.error ?? res.status}`);
        return;
      }
      alert('キャンセルを受け付けましたで御座る');
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('通信に失敗しましたで御座る');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">予約詳細</h1>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">予約ID</dt>
            <dd className="mt-1 font-mono text-sm">{detail.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">作成日時</dt>
            <dd className="mt-1 text-sm">{formatDate(detail.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">日付</dt>
            <dd className="mt-1 text-sm">{formatDate(detail.date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">枠</dt>
            <dd className="mt-1 text-sm">{detail.slot ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">人数</dt>
            <dd className="mt-1 text-sm">{totalParty} 名</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">金額</dt>
            <dd className="mt-1 text-sm" suppressHydrationWarning>
              {formatCurrency(detail.amount, 'JPY')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">状態</dt>
            <dd className="mt-1 text-sm">{detail.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">顧客</dt>
            <dd className="mt-1 text-sm">
              {detail.customer?.name ?? '-'}（{detail.customer?.email ?? '-'}）
            </dd>
          </div>
          {detail.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">メモ</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">{detail.notes}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-8 flex gap-3">
          <a
            href="/reservations"
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            一覧へ戻る
          </a>
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-rose-50 disabled:opacity-50"
            onClick={handleCancel}
            disabled={submitting || detail.status === 'CANCELLED'}
            title={
              detail.status === 'CANCELLED'
                ? 'すでにキャンセル済みで御座る'
                : '予約をキャンセルするで御座る'
            }
          >
            {detail.status === 'CANCELLED' ? 'キャンセル済み' : 'キャンセルする'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    const hh = `${d.getHours()}`.padStart(2, '0');
    const mm = `${d.getMinutes()}`.padStart(2, '0');
    return `${y}/${m}/${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function formatCurrency(amount: number, currency = 'JPY') {
  try {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString()} 円`;
  }
}
