// app/(app)/reservations/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';

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

async function fetchReservations(): Promise<ReservationDetail[]> {
  const uid = cookies().get('uid')?.value ?? '';
  const devUid = process.env.NEXT_PUBLIC_DEV_USER_ID ?? '';
  const userIdHeader = uid || devUid;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/reservations?scope=me`,
    {
      cache: 'no-store',
      headers: userIdHeader ? { 'x-user-id': userIdHeader } : undefined,
    }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.reservations ?? []) as ReservationDetail[];
}

export default async function Page() {
  const reservations = await fetchReservations();

  if (reservations.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">予約一覧</h1>
        <p className="mt-4 text-slate-600">
          予約が存在しませんで御座る。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">予約一覧</h1>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left text-sm">
              <th className="px-4 py-3 w-[140px]">作成日時</th>
              <th className="px-4 py-3 w-[140px]">日付</th>
              <th className="px-4 py-3 w-[120px]">枠</th>
              <th className="px-4 py-3 w-[80px]">人数</th>
              <th className="px-4 py-3 w-[120px]">金額</th>
              <th className="px-4 py-3 w-[120px]">状態</th>
              <th className="px-4 py-3 w-[140px]">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {reservations.map((r) => {
              const totalParty =
                (r.adultCount ?? 0) +
                (r.studentCount ?? 0) +
                (r.childCount ?? 0) +
                (r.infantCount ?? 0);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">{formatDate(r.date)}</td>
                  <td className="px-4 py-3">{r.slot ?? '-'}</td>
                  <td className="px-4 py-3">{totalParty}</td>
                  <td
                    className="px-4 py-3"
                    suppressHydrationWarning
                  >
                    {formatCurrency(r.amount, 'JPY')}
                  </td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/reservations/${r.id}`}
                      className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-100"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

// 揺れない通貨フォーマッタ
function formatCurrency(amount: number, currency = 'JPY') {
  if (currency === 'JPY') {
    const n = Math.round(Number.isFinite(amount) ? amount : 0);
    return `¥${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    const n = Math.round(Number.isFinite(amount) ? amount : 0);
    return `${currency} ${n
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}
