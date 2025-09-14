// app/api/admin/metrics/route.ts
import { NextResponse } from "next/server";
import { getUidFromCookieOrHeader, isAdmin } from "@/lib/auth/isAdmin";
import { withSpan } from "@/src/lib/obs/tracing";

async function getPrisma() {
  try {
    const mod = await import("@prisma/client");
    const { PrismaClient } = mod as typeof import("@prisma/client");
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
    await prisma.$disconnect().catch(() => {});
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  return withSpan("admin.metrics", async (span) => {
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
    } catch (e) {
      console.error("Metrics error:", e);
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
    } finally {
      await prisma.$disconnect().catch(() => {});
      span.setAttribute?.("finished", "true");
    }
  });
}
