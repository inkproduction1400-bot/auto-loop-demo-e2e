'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './customers.module.css';

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string; // ISO
  _count: { reservations: number };
};

type ApiResponse = {
  meta: { page: number; size: number; total: number; totalPages: number };
  items: Customer[];
};

const readParam = (sp: URLSearchParams, key: string, fallback = '') =>
  (sp.get(key) ?? fallback).trim();

const intOr = (sp: URLSearchParams, key: string, fallback: number) => {
  const v = Number.parseInt(sp.get(key) ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export default function CustomersPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const q = readParam(sp, 'q');
  const page = intOr(sp, 'page', 1);
  const size = Math.min(100, intOr(sp, 'size', 20));

  const apiUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    p.set('page', String(page));
    p.set('size', String(size));
    return `/api/admin/customers?${p.toString()}`;
  }, [q, page, size]);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    const q_ = String(fd.get('q') ?? '').trim();
    if (q_) next.set('q', q_);
    next.set('page', '1');
    next.set('size', String(size));
    router.push(`/admin/customers?${next.toString()}`);
  };

  const makePageHref = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(p));
    next.set('size', String(size));
    return `/admin/customers?${next.toString()}`;
  };

  return (
    <>
      <h1 className={styles.title}>顧客一覧</h1>

      <form className={styles.toolbar} onSubmit={onSubmit}>
        <input name="q" placeholder="氏名/メール/電話" defaultValue={q} />
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
                  <th>氏名</th>
                  <th>メール</th>
                  <th>電話</th>
                  <th>予約数</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>{new Date(c.createdAt).toLocaleString('ja-JP')}</td>
                    <td>{c.name ?? '-'}</td>
                    <td>{c.email ?? '-'}</td>
                    <td>{c.phone ?? '-'}</td>
                    <td>
                      <Link href={`/admin/reservations?q=${encodeURIComponent(c.email ?? '')}`}>
                        {c._count.reservations}
                      </Link>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                      データがありません
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
