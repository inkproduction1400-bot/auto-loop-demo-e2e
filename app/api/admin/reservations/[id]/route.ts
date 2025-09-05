// app/api/admin/reservations/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// /api/admin/reservations/[id] : GET / PATCH / DELETE

type Params = { params: { id: string } };

// 予約詳細取得
export async function GET(_req: Request, { params }: Params) {
  const { id } = params;
  try {
    const r = await prisma.reservation.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!r) return NextResponse.json({ message: 'Not Found' }, { status: 404 });
    return NextResponse.json(r);
  } catch (e) {
    console.error('[GET /admin/reservations/:id] error', e);
    return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
  }
}

// ステータス/メモ更新
export async function PATCH(req: Request, { params }: Params) {
  const { id } = params;
  try {
    const body = await req.json().catch(() => ({}));
    const { status, notes } = body as {
      status?: 'PENDING' | 'PAID' | 'CANCELLED';
      notes?: string | null;
    };

    // 何も更新項目が無ければ 400
    if (status === undefined && notes === undefined) {
      return NextResponse.json(
        { message: 'No fields to update' },
        { status: 400 },
      );
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('[PATCH /admin/reservations/:id] error', e);
    return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
  }
}

// 予約キャンセル（論理）: ステータスを CANCELLED に
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = params;
  try {
    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('[DELETE /admin/reservations/:id] error', e);
    return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
  }
}
