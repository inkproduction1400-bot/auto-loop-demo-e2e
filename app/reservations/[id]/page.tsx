// app/(app)/reservations/[id]/page.tsx
import { cookies } from 'next/headers';
import ReservationDetailClient from '@/components/reservations/ReservationDetailClient';

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

export const dynamic = 'force-dynamic';

async function fetchDetail(id: string): Promise<ReservationDetail | null> {
  const uid = cookies().get('uid')?.value ?? '';
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/reservations/${id}`,
    { cache: 'no-store', headers: uid ? { 'x-user-id': uid } : undefined }
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
        <p className="mt-4 text-slate-600">
          予約が見つからないか、権限がありませんで御座る。
        </p>
        <div className="mt-6">
          <a
            href="/reservations"
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            一覧へ戻る
          </a>
        </div>
      </div>
    );
  }

  // ✅ CSR 部分は ReservationDetailClient に委譲
  return <ReservationDetailClient detail={detail} />;
}
