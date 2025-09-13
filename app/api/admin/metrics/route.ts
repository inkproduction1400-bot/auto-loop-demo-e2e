// app/api/admin/metrics/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getUidFromCookieOrHeader, isAdmin } from "@/lib/auth/isAdmin";

async function getPrisma(): Promise<any | null> {
  try {
    const mod = await import("@prisma/client");
    const PrismaClient = (mod as any).PrismaClient;
    return new PrismaClient();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({ ok: false, error: "prisma not available" }, { status: 503 });
  }

  const uid = getUidFromCookieOrHeader(req);
  if (!isAdmin(uid)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  return Sentry.startSpan({ name: "admin.metrics" }, async (span) => {
    try {
      const [totalReservations, revenue, latest] = await Promise.all([
        prisma.reservation.count(),
        prisma.reservation.aggregate({
          _sum: { amount: true },
          where: { status: { in: ["PENDING", "CONFIRMED"] } }, // CANCELLEDは売上除外
        }),
        prisma.reservation.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { customer: { select: { name: true, email: true } } },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        metrics: {
          totalReservations,
          totalRevenue: revenue._sum.amount ?? 0,
          latest,
        },
      });
    } catch (e: any) {
      Sentry.captureException(e);
      return NextResponse.json({ ok: false, error: e?.message ?? "error" }, { status: 500 });
    } finally {
      await prisma.$disconnect().catch(() => {});
      span.end?.();
    }
  });
}
