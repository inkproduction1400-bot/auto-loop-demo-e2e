// app/api/admin/customers/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Meta = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

// Prisma から返る1件分の型
type CustomerRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
  _count: { reservations: number };
};

const intOr = (v: string | null, fallback: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();
    const page = intOr(searchParams.get('page'), 1);
    const size = Math.min(100, intOr(searchParams.get('size'), 20));
    const skip = (page - 1) * size;

    // 検索条件
    const where =
      q === ''
        ? undefined
        : {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
            ],
          };

    // total 件数
    const total = await prisma.customer.count({ where });

    // ページデータ
    const rows = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { reservations: true } },
      },
    });

    // UI が期待する形に整形
    const items = rows.map((c: CustomerRow) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt.toISOString(),
      _count: { reservations: c._count.reservations },
    }));

    const meta: Meta = {
      page,
      size,
      total,
      totalPages: Math.max(1, Math.ceil(total / size)),
    };

    return NextResponse.json({ meta, items });
  } catch (e: any) {
    console.error('GET /api/admin/customers error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'internal error' },
      { status: 500 }
    );
  }
}
