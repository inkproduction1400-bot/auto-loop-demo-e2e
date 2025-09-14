// components/reservations/ReservationTable.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Reservation, ReservationListResponse } from '@/lib/types';

type Props = { initial: ReservationListResponse };

// サーバから返る予約アイテムの最小形（受け口）
type ApiReservationItem = Partial<
  Reservation & {
    adultCount: number;
    studentCount: number;
    childCount: number;
    infantCount: number;
    created_at: string;
    slot: string | null;
  }
>;
type ApiMeta = Partial<{ total: number; page: number; limit: number }>;
type ReservationsApiShape = { reservations?: unknown; meta?: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function toStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asApiItems(v: unknown): ApiReservationItem[] {
  return Array.isArray(v) ? (v as ApiReservationItem[]) : [];
}
function asApiMeta(v: unknown): ApiMeta {
  return isRecord(v) ? (v as ApiMeta) : {};
}

// status の正規化関数
function normalizeStatus(v: unknown): Reservation['status'] {
  const up = String(v ?? 'PENDING').toUpperCase();
  // API 側では PAID/CONFIRMED/CANCELLED/CANCELED の揺れがある想定
  if (up === 'CANCELLED' || up === 'CANCELED') return 'CANCELED';
  if (up === 'PAID' || up === 'CONFIRMED') return 'CONFIRMED'; // PAID を CONFIRMED に丸める
  return 'PENDING';
}

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

      const json: unknown = await res.json();
      const payload: ReservationsApiShape = isRecord(json)
        ? (json as ReservationsApiShape)
        : {};
      const items = asApiItems(payload.reservations);
      const meta = asApiMeta(payload.meta);

      const mapped: ReservationListResponse = {
        data: items.map((r): Reservation => {
          const partySize =
            r.partySize ??
            (toNum(r.adultCount) +
              toNum(r.studentCount) +
              toNum(r.childCount) +
              toNum(r.infantCount));

          const slotLabel: Reservation['slotLabel'] =
            r.slotLabel ?? (typeof r.slot === 'string' ? r.slot : undefined);

          return {
            id: toStr(r.id, ''),
            createdAt: toStr(r.createdAt ?? r.created_at, ''),
            date: toStr(r.date, ''),
            slotLabel,
            partySize: partySize || 0,
            amount: toNum(r.amount, 0),
            currency: toStr(r.currency, 'JPY'),
            customerName: toStr(r.customerName, ''),
            status: normalizeStatus(r.status),
          };
        }),
        total: toNum(meta.total, 0),
        page: toNum(meta.page, p),
        pageSize: toNum(meta.limit, pageSize),
      };

      setData(mapped.data);
      setTotal(mapped.total);
      setPage(mapped.page);
    } catch (e: unknown) {
      console.error(e);
      alert(
        `予約一覧の取得に失敗しましたで御座る：${
          e instanceof Error ? e.message : '不明なエラー'
        }`
      );
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
      const json: unknown = await res.json();
      const okFlag = isRecord(json) && (json as { ok?: boolean }).ok === true;

      if (!res.ok || !okFlag) {
        const msg = isRecord(json)
          ? toStr((json as { error?: unknown }).error, String(res.status))
          : String(res.status);
        alert(`キャンセルに失敗しましたで御座る：${msg}`);
        return;
      }
      alert('キャンセルを受け付けましたで御座る');
      await load(page);
    } catch (e: unknown) {
      console.error(e);
      alert(
        `通信に失敗しましたで御座る：${
          e instanceof Error ? e.message : '不明なエラー'
        }`
      );
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
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  読み込み中で御座る…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  該当データがありませんで御座る
                </td>
              </tr>
            ) : (
              data.map((r) => {
                const isCancelled = r.status === 'CANCELED';
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">{r.slotLabel ?? '-'}</td>
                    <td className="px-4 py-3">{r.partySize}</td>
                    <td className="px-4 py-3" suppressHydrationWarning>
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
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
    return `${d.getFullYear()}/${`${d.getMonth() + 1}`.padStart(2, '0')}/${`${d.getDate()}`.padStart(2, '0')} ${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function formatCurrency(amount: number, currency = 'JPY') {
  if (currency === 'JPY') {
    const n = Math.round(Number.isFinite(amount) ? amount : 0);
    return `¥${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    const n = Math.round(Number.isFinite(amount) ? amount : 0);
    return `${currency} ${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}
