// app/api/payments/confirm/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

async function getPrisma(): Promise<null | InstanceType<any>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import("@prisma/client");
    const PrismaClient = (mod as any).PrismaClient;
    return new PrismaClient();
  } catch {
    return null;
  }
}

function json(message: any, status = 200) {
  return NextResponse.json(message, { status });
}

export async function POST(req: Request) {
  return await Sentry.startSpan({ name: "payments.confirm" }, async (rootSpan) => {
    const prisma = await getPrisma();
    if (!prisma) return json({ ok: false, error: "server not ready" }, 503);

    try {
      const body = await req.json().catch(() => ({}));
      const reservationId = String(body?.reservationId ?? "");
      const paymentIntentId = String(body?.paymentIntentId ?? `mock_${Date.now()}`);

      if (!reservationId) return json({ ok: false, error: "reservationId required" }, 400);

      // すでに確定済みなら idempotent に返す
      const exists = await (prisma as any).reservation.findUnique({
        where: { id: reservationId },
        select: { id: true, status: true },
      });
      if (!exists) return json({ ok: false, error: "reservation not found" }, 404);
      if (exists.status === "CONFIRMED") return json({ ok: true, reservationId, status: "CONFIRMED" });

      const updated = await Sentry.startSpan({ name: "payments.confirm.db" }, async (dbSpan) => {
        const rec = await (prisma as any).reservation.update({
          where: { id: reservationId },
          data: {
            status: "CONFIRMED",
            paymentIntentId, // Prisma schema にカラムあり
          },
        });
        dbSpan?.setAttribute?.("reservation.id", rec.id);
        return rec;
      });

      Sentry.addBreadcrumb({
        category: "payment",
        level: "info",
        message: "payments.confirm:success",
        data: { reservationId: updated.id },
      });

      return json({ ok: true, reservationId: updated.id, status: updated.status });
    } catch (err: any) {
      Sentry.captureException(err, { extra: { endpoint: "payments.confirm" } });
      return json({ ok: false, error: err?.message ?? "update failed" }, 500);
    } finally {
      try {
        await (prisma as any).$disconnect();
      } catch {}
      rootSpan?.end?.();
    }
  });
}
