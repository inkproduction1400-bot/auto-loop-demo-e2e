import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 文字列→数値（不正時は fallback）
function intOr(v: string | null, fallback: number) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  const page = intOr(url.searchParams.get('page'), 1);
  const size = Math.min(100, intOr(url.searchParams.get('size'), 20));
  const skip = (page - 1) * size;

  // Prisma の型は明示せずに構築（型推論に任せる）
  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
        include: { _count: { select: { reservations: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    type Item = (typeof items)[number];

    // Date を ISO にして CSR で扱いやすく
    const jsonItems = items.map((c: Item) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt ? c.updatedAt.toISOString() : undefined,
      _count: { reservations: (c as any)._count?.reservations ?? 0 },
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
    console.error('[GET /api/admin/customers] error', e);
    return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
  }
}
