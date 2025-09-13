// components/reservations/ReservationTable.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Reservation, ReservationListResponse } from '@/lib/types';

type Props = { initial: ReservationListResponse };

export default function ReservationTable({ initial }: Props) {
  const router = useRouter();
  const [page, setPage] = React.useState(initial.page);
  const [pageSize] = React.useState(initial.pageSize);
  const [loading, setLoading] = React.useState(false);
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Reservation[]>(initial.data);
  const [total, setTotal] = React.useState(initial.total);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(p: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reservations?scope=me&page=${p}&limit=${pageSize}&sort=-createdAt`,
        { cache: 'no-store', credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch reservations');
      const json = await res.json();
      const items = Array.isArray(json?.reservations) ? json.reservations : [];
      const meta = json?.meta ?? {};
      const mapped: ReservationListResponse = {
        data: items.map((r: any) => ({
          id: String(r.id),
          createdAt: String(r.createdAt ?? r.created_at ?? ''),
          date: String(r.date ?? ''),
          slotLabel: r.slot ?? r.slotLabel ?? null,
          partySize:
            (r.partySize ??
              r.adultCount + r.studentCount + r.childCount + r.infantCount ??
              0) || 0,
          amount: Number(r.amount ?? 0),
          currency: String(r.currency ?? 'JPY'),
          customerName: String(r.customerName ?? ''),
          status: String(r.status ?? 'PENDING'),
        })),
        total: Number(meta.total ?? 0),
        page: Number(meta.page ?? p),
        pageSize: Number(meta.limit ?? pageSize),
      };
      setData(mapped.data);
      setTotal(mapped.total);
      setPage(mapped.page);
    } catch (e) {
      console.error(e);
      alert('予約一覧の取得に失敗しましたで御座る');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (submittingId) return;
    const reason = window.prompt('キャンセル理由（任意）を入力してくださいで御座る：') ?? '';
    const ok = window.confirm('本当にキャンセルしますかで御座る？');
    if (!ok) return;

    setSubmittingId(id);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
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
      // 現在のページを再取得して反映
      await load(page);
    } catch (e) {
      console.error(e);
      alert('通信に失敗しましたで御座る');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left text-sm">
              <th className="px-4 py-3 w-[140px]">作成</th>
              <th className="px-4 py-3 w-[140px]">日付</th>
              <th className="px-4 py-3 w-[120px]">枠</th>
              <th className="px-4 py-3 w-[80px]">人数</th>
              <th className="px-4 py-3 w-[120px]">金額</th>
              <th className="px-4 py-3 w-[120px]">状態</th>
              <th className="px-4 py-3 w-[140px]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>読み込み中で御座る…</td></tr>
            ) : data.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>該当データがありませんで御座る</td></tr>
            ) : (
              data.map((r) => {
                const isCancelled = String(r.status).toUpperCase() === 'CANCELLED';
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">{r.slotLabel ?? '-'}</td>
                    <td className="px-4 py-3">{r.partySize}</td>
                    <td className="px-4 py-3" suppressHydrationWarning>
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status as any} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-100"
                          onClick={() => router.push(`/reservations/${r.id}`)}
                        >
                          詳細
                        </button>
                        {isCancelled ? (
                          <span className="text-xs text-slate-400">キャンセル済み</span>
                        ) : (
                          <button
                            className="rounded-lg border px-3 py-1 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                            onClick={() => handleCancel(r.id)}
                            disabled={submittingId === r.id}
                            title="この予約をキャンセルするで御座る"
                          >
                            {submittingId === r.id ? '処理中…' : 'キャンセル'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
          disabled={page <= 1 || loading}
          onClick={() => load(page - 1)}
        >
          前へ
        </button>
        <span className="text-sm text-slate-600">
          {page} / {totalPages}
        </span>
        <button
          className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
          disabled={page >= totalPages || loading}
          onClick={() => load(page + 1)}
        >
          次へ
        </button>
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

// 揺れない JPY フォーマッタ
function formatCurrency(amount: number, currency = 'JPY') {
  if (currency === 'JPY') {
    const n = Math.round(Number.isFinite(amount) ? amount : 0);
    const s = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `¥${s}`;
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    const n = Math.round(Number.isFinite(amount) ? amount : 0);
    const s = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${currency} ${s}`;
  }
}
