// app/(app)/reservations/[id]/page.tsx
import { cookies } from 'next/headers';

type ReservationDetail = {
  id: string;
  userId?: string | null;
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

export const dynamic = 'force-dynamic';

async function fetchDetail(id: string): Promise<ReservationDetail | null> {
  // Cookie もしくは DEV 用 UID をヘッダに載せる
  const uid = cookies().get('uid')?.value ?? '';
  const devUid = process.env.NEXT_PUBLIC_DEV_USER_ID ?? '';
  const userIdHeader = uid || devUid;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/reservations/${id}`,
    { cache: 'no-store', headers: userIdHeader ? { 'x-user-id': userIdHeader } : undefined }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.reservation ?? null) as ReservationDetail | null;
}

export default async function Page({ params }: { params: { id: string } }) {
  const detail = await fetchDetail(params.id);

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">予約詳細</h1>
        <p className="mt-4 text-slate-600">予約が見つからないか、権限がありませんで御座る。</p>
        <div className="mt-6">
          <a href="/reservations" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
            一覧へ戻る
          </a>
        </div>
      </div>
    );
  }

  const totalParty =
    (detail.adultCount ?? 0) +
    (detail.studentCount ?? 0) +
    (detail.childCount ?? 0) +
    (detail.infantCount ?? 0);

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
          <a href="/reservations" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
            一覧へ戻る
          </a>
          {/* 今後：キャンセルや領収書DLなどのボタンをここに追加するで御座る */}
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

// 揺れない通貨フォーマッタ（SSR/CSR 一致）
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
