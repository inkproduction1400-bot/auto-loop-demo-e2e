import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function intOr(v: string | null, fallback: number) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const q = (url.searchParams.get('q') ?? '').trim();
  const statusRaw = (url.searchParams.get('status') ?? '').trim() as
    | 'PENDING'
    | 'PAID'
    | 'CANCELLED'
    | '';
  const dateFromRaw = (url.searchParams.get('dateFrom') ?? '').trim();
  const dateToRaw = (url.searchParams.get('dateTo') ?? '').trim();

  const page = intOr(url.searchParams.get('page'), 1);
  const size = Math.min(100, intOr(url.searchParams.get('size'), 20));
  const skip = (page - 1) * size;

  // Prisma の型は使わない
  const where: any = {};
  if (q) {
    where.OR = [
      { slot: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { email: { contains: q } } },
    ];
  }
  if (statusRaw) {
    // enum 型参照はやめ、文字列のまま渡す
    where.status = statusRaw;
  }
  if (dateFromRaw || dateToRaw) {
    where.createdAt = {};
    if (dateFromRaw) where.createdAt.gte = new Date(dateFromRaw);
    if (dateToRaw) {
      const end = new Date(dateToRaw);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  try {
    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      prisma.reservation.count({ where }),
    ]);

    type R = (typeof items)[number];

    const jsonItems = items.map((r: R) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
      date: r.date.toISOString(),
      slot: r.slot,
      counts: (r.counts ?? null) as Record<string, number> | null,
      amount: r.amount,
      status: r.status,
      customer: r.customer
        ? { id: r.customer.id, name: r.customer.name, email: r.customer.email }
        : null,
    }));

    return NextResponse.json({
      meta: {
        page,
        size,
        total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
      items: jsonItems,
    });
  } catch (e) {
    console.error('[GET /api/admin/reservations] error', e);
    return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
  }
}
