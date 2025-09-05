// app/admin/reservations/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
};

type Reservation = {
  id: string;
  createdAt: string; // ISO string
  date: string;      // ISO string
  slot: string;
  counts: Record<string, number> | null;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  customer: Customer | null;
};

type ApiResponse = {
  meta: { page: number; size: number; total: number; totalPages: number };
  items: Reservation[];
};

function readParam(sp: URLSearchParams, key: string, fallback = '') {
  return (sp.get(key) ?? fallback).trim();
}

function intOr(sp: URLSearchParams, key: string, fallback: number) {
  const v = Number.parseInt(sp.get(key) ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export default function ReservationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 検索条件（URL → 状態）
  const q = readParam(searchParams, 'q');
  const status = readParam(searchParams, 'status');
  const dateFrom = readParam(searchParams, 'dateFrom');
  const dateTo = readParam(searchParams, 'dateTo');
  const page = intOr(searchParams, 'page', 1);
  const size = Math.min(100, intOr(searchParams, 'size', 20));

  // API フェッチ状態
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  // クエリ文字列を都度作り直す（依存列に URL 検索条件を入れる）
  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (status) sp.set('status', status);
    if (dateFrom) sp.set('dateFrom', dateFrom);
    if (dateTo) sp.set('dateTo', dateTo);
    sp.set('page', String(page));
    sp.set('size', String(size));
    return `/api/admin/reservations?${sp.toString()}`;
  }, [q, status, dateFrom, dateTo, page, size]);

  // フェッチ
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
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

  // フォーム submit → URL を更新（page は 1 に戻す）
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    const q_ = String(fd.get('q') ?? '').trim();
    const status_ = String(fd.get('status') ?? '').trim();
    const df_ = String(fd.get('dateFrom') ?? '').trim();
    const dt_ = String(fd.get('dateTo') ?? '').trim();

    if (q_) sp.set('q', q_);
    if (status_) sp.set('status', status_);
    if (df_) sp.set('dateFrom', df_);
    if (dt_) sp.set('dateTo', dt_);
    // ページング
    sp.set('page', '1');
    sp.set('size', String(size));

    router.push(`/admin/reservations?${sp.toString()}`);
  };

  // ページャ用：現状の検索条件を保ちつつ page/size だけ更新
  const makePageHref = (p: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('page', String(p));
    sp.set('size', String(size));
    return `/admin/reservations?${sp.toString()}`;
  };

  return (
    <>
      <h1 className={styles.title}>予約一覧</h1>

      <form className={styles.toolbar} onSubmit={onSubmit}>
        <input name="q" placeholder="キーワード" defaultValue={q} />
        <input name="dateFrom" type="date" defaultValue={dateFrom} />
        <input name="dateTo" type="date" defaultValue={dateTo} />
        <select name="status" defaultValue={status}>
          <option value="">すべての状態</option>
          <option value="PENDING">PENDING</option>
          <option value="PAID">PAID</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <button type="submit">検索</button>
      </form>

      {loading && <div className={styles.meta}>読み込み中…</div>}
      {err && <div className={styles.error}>読み込みに失敗しました: {err}</div>}

      {data && (
        <>
          <div className={styles.meta}>
            {data.meta.total}件 / {data.meta.page}/{data.meta.totalPages}ページ
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>作成</th>
                  <th>日付</th>
                  <th>枠</th>
                  <th>人数</th>
                  <th>金額</th>
                  <th>顧客</th>
                  <th>状態</th>
                  <th>詳細</th>{/* ← 追加 */}
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => {
                  const c = (r.counts ?? {}) as Record<string, number>;
                  const totalPeople =
                    (c.adult ?? 0) + (c.student ?? 0) + (c.child ?? 0) + (c.infant ?? 0);
                  return (
                    <tr key={r.id}>
                      <td>{new Date(r.createdAt).toLocaleString('ja-JP')}</td>
                      <td>{new Date(r.date).toLocaleDateString('ja-JP')}</td>
                      <td>{r.slot}</td>
                      <td>{totalPeople}</td>
                      <td>¥{r.amount.toLocaleString('ja-JP')}</td>
                      <td>
                        {r.customer ? (
                          <>
                            <div>{r.customer.name}</div>
                            <div className={styles.muted}>{r.customer.email}</div>
                          </>
                        ) : (
                          <span className={styles.muted}>-</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.chip} ${styles[`chip_${r.status.toLowerCase()}`]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {/* ← ここを追加：詳細ページへのリンク */}
                        <Link href={`/admin/reservations/${r.id}`}>詳細</Link>
                      </td>
                    </tr>
                  );
                })}

                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                      該当データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            {Array.from({ length: data.meta.totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <Link
                  key={p}
                  href={makePageHref(p)}
                  className={`${styles.pagebtn} ${p === data.meta.page ? styles.active : ''}`}
                >
                  {p}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
