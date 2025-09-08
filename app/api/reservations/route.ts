// app/api/reservations/route.ts
import { NextResponse } from 'next/server';

/**
 * Prisma を遅延 import して、prisma generate 未実行でもビルド通過できるようにする
 */
async function getPrisma(): Promise<null | InstanceType<any>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import('@prisma/client');
    const PrismaClient = (mod as any).PrismaClient;
    return new PrismaClient();
  } catch {
    return null; // prisma generate 未実行などの場合
  }
}

/**
 * GET /api/reservations
 * - 予約一覧を返す
 * - Prisma が無ければ空配列を返す
 */
export async function GET() {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json(
      {
        ok: true,
        reservations: [],
        note: 'prisma not available (returning mock data)',
      },
      { status: 200 }
    );
  }

  try {
    const reservations = await (prisma as any).reservation.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    await (prisma as any).$disconnect();
    return NextResponse.json({ ok: true, reservations });
  } catch (err: any) {
    await (prisma as any).$disconnect().catch(() => {});
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'DB error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reservations
 * - 新しい予約を作成
 * - Prisma が無ければ 503 を返す
 */
export async function POST(req: Request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json(
      { ok: false, error: 'prisma not available' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const created = await (prisma as any).reservation.create({
      data: body ?? {},
    });
    await (prisma as any).$disconnect();
    return NextResponse.json({ ok: true, reservation: created }, { status: 201 });
  } catch (err: any) {
    await (prisma as any).$disconnect().catch(() => {});
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'DB error' },
      { status: 500 }
    );
  }
}
