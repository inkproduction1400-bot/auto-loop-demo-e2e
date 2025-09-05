// app/admin/reservations/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type Reservation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  slot: string;
  counts: Record<string, number> | null;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  notes: string | null;
  customer: Customer | null;
};

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');

  const apiUrl = useMemo(() => `/api/admin/reservations/${id}`, [id]);

  // 取得
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Reservation = await res.json();
        if (!cancelled) {
          setData(json);
          setNotes(json.notes ?? '');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'fetch error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const setStatus = async (status: Reservation['status']) => {
    if (!confirm(`ステータスを ${status} に変更します。よろしいですか？`)) return;
    await fetch(apiUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  };

  const saveNotes = async () => {
    await fetch(apiUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    router.refresh();
  };

  const cancelReservation = async () => {
    if (!confirm('この予約をキャンセルします。よろしいですか？')) return;
    await fetch(apiUrl, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <div className="wrap">
      <div className="hdr">
        <h1>予約詳細</h1>
        <div className="gap" />
        <Link href="/admin/reservations" className="btn ghost">一覧に戻る</Link>
      </div>

      {loading && <div className="meta">読み込み中…</div>}
      {err && <div className="error">読み込みに失敗しました: {err}</div>}

      {data && (
        <>
          <div className="grid">
            <div className="card">
              <div className="card-ttl">概要</div>
              <dl className="dl">
                <dt>ID</dt><dd>{data.id}</dd>
                <dt>作成</dt><dd>{new Date(data.createdAt).toLocaleString('ja-JP')}</dd>
                <dt>更新</dt><dd>{new Date(data.updatedAt).toLocaleString('ja-JP')}</dd>
                <dt>日付</dt><dd>{new Date(data.date).toLocaleDateString('ja-JP')}</dd>
                <dt>枠</dt><dd>{data.slot}</dd>
                <dt>人数</dt>
                <dd>
                  {(() => {
                    const c = (data.counts ?? {}) as Record<string, number>;
                    const total =
                      (c.adult ?? 0) + (c.student ?? 0) + (c.child ?? 0) + (c.infant ?? 0);
                    return `${total} 名（大人${c.adult ?? 0} / 学生${c.student ?? 0} / 小人${c.child ?? 0} / 幼児${c.infant ?? 0}）`;
                  })()}
                </dd>
                <dt>金額</dt><dd>¥{data.amount.toLocaleString('ja-JP')}</dd>
                <dt>状態</dt>
                <dd>
                  <span className={`chip ${data.status.toLowerCase()}`}>{data.status}</span>
                </dd>
              </dl>

              <div className="actions">
                <button className="btn" onClick={() => setStatus('PAID')}>支払い済みにする</button>
                <button className="btn" onClick={() => setStatus('PENDING')}>保留に戻す</button>
                <button className="btn danger" onClick={cancelReservation}>キャンセル</button>
              </div>
            </div>

            <div className="card">
              <div className="card-ttl">顧客</div>
              {data.customer ? (
                <dl className="dl">
                  <dt>氏名</dt><dd>{data.customer.name ?? '-'}</dd>
                  <dt>メール</dt><dd>{data.customer.email ?? '-'}</dd>
                  <dt>電話</dt><dd>{data.customer.phone ?? '-'}</dd>
                </dl>
              ) : (
                <div className="muted">顧客情報なし</div>
              )}

              <div className="card-ttl mt">メモ</div>
              <textarea
                className="input"
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="社内用メモを記入…"
              />
              <div className="actions">
                <button className="btn primary" onClick={saveNotes}>メモを保存</button>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .wrap { display: grid; gap: 12px; }
        .hdr { display: flex; align-items: center; gap: 8px; }
        .hdr h1 { margin: 0; font-weight: 900; }
        .gap { flex: 1; }
        .meta { color: #64748b; font-size: 13px; }
        .error { color: #b91c1c; background: #fee2e2; border: 1px solid #fecaca; padding: 8px 10px; border-radius: 10px; }

        .grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
        }
        @media (max-width: 960px) {
          .grid { grid-template-columns: 1fr; }
        }

        .card {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;
        }
        .card-ttl { font-weight: 800; margin-bottom: 8px; }

        .dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; align-items: start; }
        .dl dt { color: #64748b; font-size: 12px; }
        .dl dd { margin: 0; }

        .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

        .btn {
          appearance: none; border: 1px solid #cbd5e1; background: #fff; color: #0f172a;
          padding: 8px 12px; border-radius: 10px; cursor: pointer;
        }
        .btn:hover { background: #f8fafc; }
        .btn.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
        .btn.ghost { background: #fff; }
        .btn.danger { color: #b91c1c; border-color: #fecaca; background: #fff5f5; }

        .chip {
          padding: 3px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #cbd5e1;
        }
        .chip.paid { background: #ecfdf5; border-color: #bbf7d0; color: #0f766e; }
        .chip.pending { background: #fff7ed; border-color: #fed7aa; color: #c2410c; }
        .chip.cancelled { background: #fee2e2; border-color: #fecaca; color: #b91c1c; }

        .muted { color: #64748b; font-size: 12px; }
        .mt { margin-top: 12px; }

        .input {
          width: 100%; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; font-size: 14px;
          background: #fff;
        }
      `}</style>
    </div>
  );
}
