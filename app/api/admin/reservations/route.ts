// app/api/reservations/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSpan, logError } from '@/lib/obs/logger';

function intOr(v: string | null, fallback: number) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** GET /api/reservations */
export async function GET(req: Request) {
  return await withSpan('api.reservations.GET', async () => {
    const url = new URL(req.url);

    const q = (url.searchParams.get('q') ?? '').trim();
    const statusRaw = (url.searchParams.get('status') ?? '').trim() as
      | 'PENDING'
      | 'PAID'
      | 'CANCELED'
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
        withSpan(
          'db.reservation.findMany',
          () =>
            prisma.reservation.findMany({
              where,
              include: { customer: true },
              orderBy: { createdAt: 'desc' },
              skip,
              take: size,
            }),
          { skip, take: size },
        ),
        withSpan('db.reservation.count', () => prisma.reservation.count({ where }), {
          hasFilter: !!q || !!statusRaw || !!dateFromRaw || !!dateToRaw,
        }),
      ]);

      const jsonItems = items.map((r: any) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        date: r.date.toISOString(),
        slot: r.slot,
        counts: {
          adult: r.adultCount,
          student: r.studentCount,
          child: r.childCount,
          infant: r.infantCount,
        },
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
      logError(e, {
        route: 'GET /api/reservations',
        q,
        statusRaw,
        dateFromRaw,
        dateToRaw,
        page,
        size,
      });
      return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
    }
  });
}

/** POST /api/reservations */
export async function POST(req: Request) {
  return withSpan(
    'api.reservations.POST',
    async () => {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
      }

      const dateInput: string | undefined = body?.date;
      const slot: string | undefined = (body?.slot ?? '').trim() || undefined;
      const amount: number | undefined = Number.isFinite(body?.amount) ? Number(body.amount) : undefined;

      const counts = body?.counts ?? {};
      const adultCount   = Number.isFinite(counts?.adult)   ? Number(counts.adult)   : 0;
      const studentCount = Number.isFinite(counts?.student) ? Number(counts.student) : 0;
      const childCount   = Number.isFinite(counts?.child)   ? Number(counts.child)   : 0;
      const infantCount  = Number.isFinite(counts?.infant)  ? Number(counts.infant)  : 0;

      const customerIn = body?.customer ?? {};
      const customerEmail: string | undefined = (customerIn?.email ?? '').trim() || undefined;
      const customerName: string = (customerIn?.name ?? '').trim();
      const customerPhone: string | undefined = (customerIn?.phone ?? '').trim() || undefined;

      const errors: string[] = [];
      if (!dateInput) errors.push('date is required');
      if (!slot) errors.push('slot is required');
      if (amount == null || amount < 0) errors.push('amount is required');
      if (!customerEmail) errors.push('customer.email is required');

      let date: Date | null = null;
      if (dateInput) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          const [y, m, d] = dateInput.split('-').map(Number);
          date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        } else {
          const t = Date.parse(dateInput);
          if (!Number.isFinite(t)) errors.push('date is invalid');
          else date = new Date(t);
        }
      }

      if (errors.length) {
        return NextResponse.json({ message: 'Validation error', errors }, { status: 400 });
      }

      try {
        const customer = await withSpan('reservations.upsertCustomer', async () => {
          return prisma.customer.upsert({
            where: { email: customerEmail! },
            update: { name: customerName || undefined, phone: customerPhone },
            create: {
              name: customerName || customerEmail!.split('@')[0],
              email: customerEmail!,
              phone: customerPhone,
            },
          });
        });

        const created = await withSpan('reservations.create', async () => {
          // 👇 型の厳格エラー回避のため `data` を any にキャスト
          const data: any = {
            date: date!,               // 必須
            slot: slot!,               // 必須
            amount: amount!,           // 必須
            status: String(body?.status ?? 'PENDING'), // PrismaスキーマがStringの場合
            adultCount,
            studentCount,
            childCount,
            infantCount,
            customerId: customer.id,
            notes: body?.notes ?? null,
          };

          return prisma.reservation.create({
            data,
            include: { customer: true },
          });
        });

        return NextResponse.json({ ok: true, reservation: created }, { status: 201 });
      } catch (err) {
        logError(err as unknown, {
          route: 'POST /api/reservations',
          slot,
          amount,
          customerEmail,
        });
        return NextResponse.json({ ok: false, message: 'DB Error' }, { status: 500 });
      }
    },
    { route: '/api/reservations', op: 'http.server' },
  );
}
