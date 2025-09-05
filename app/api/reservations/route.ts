import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const status = searchParams.get('status') || undefined;

  const where: any = {};
  if (q) {
    where.OR = [
      { customer: { name: { contains: q } } },
      { customer: { email: { contains: q } } },
      { slot: { contains: q } },
    ];
  }
  if (status) where.status = status;

  const items = await prisma.reservation.findMany({
    where,
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  // 予約ウィジェットからの保存（今は決済前提のPENDING）
  const { dateISO, slot, counts, amount, customer } = body;

  const c = await prisma.customer.upsert({
    where: { email: customer.email },
    update: { name: customer.name, phone: customer.phone ?? null },
    create: { name: customer.name, email: customer.email, phone: customer.phone ?? null },
  });

  const resv = await prisma.reservation.create({
    data: {
      date: new Date(dateISO),
      slot,
      counts,
      amount,
      status: 'PENDING',
      customerId: c.id,
    },
    include: { customer: true },
  });

  return NextResponse.json(resv, { status: 201 });
}
