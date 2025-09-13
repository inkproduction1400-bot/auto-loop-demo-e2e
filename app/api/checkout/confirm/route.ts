// app/api/checkout/confirm/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { sendMail } from "@/lib/notify/mailer";
import { buildPaymentSucceeded } from "@/lib/notify/templates";

/** Prisma を遅延 import */
async function getPrisma(): Promise<null | InstanceType<any>> {
  try {
    const mod = await import("@prisma/client");
    const PrismaClient = (mod as any).PrismaClient;
    return new PrismaClient();
  } catch {
    return null;
  }
}

function s(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

// GET /api/checkout/confirm
// - Mock:   /api/checkout/confirm?status=success&reservationId=xxx&amount=1200&currency=jpy
// - Stripe: /api/checkout/confirm?session_id=cs_test_...
export async function GET(req: Request) {
  const prisma = await getPrisma();

  if (!prisma) {
    Sentry.captureMessage("checkout.confirm: prisma not available", { level: "error" });
    return NextResponse.json({ ok: false, error: "prisma not available" }, { status: 503 });
  }

  return Sentry.startSpan({ name: "checkout.confirm" }, async (rootSpan) => {
    try {
      const url = new URL(req.url);
      const isMock = process.env.E2E_STRIPE_MOCK === "1" || url.searchParams.get("mock") === "1";

      let reservationId = "";
      let amount: number | undefined = undefined;
      let currency = "jpy";
      let paymentIntentId = "";

      if (isMock) {
        // ---- Mock ルート（UI からクエリを直で受け取る）
        const status = url.searchParams.get("status");
        if (status !== "success") {
          return NextResponse.json({ ok: false, error: "status is not success (mock)" }, { status: 400 });
        }
        reservationId = s(url.searchParams.get("reservationId"));
        amount = Number(url.searchParams.get("amount") ?? "");
        currency = (s(url.searchParams.get("currency") ?? "jpy") || "jpy").toLowerCase();
        paymentIntentId = `mock_${Date.now()}`;
      } else {
        // ---- Stripe 本番ルート
        const sessionId = url.searchParams.get("session_id");
        if (!sessionId) {
          return NextResponse.json({ ok: false, error: "missing session_id" }, { status: 400 });
        }

        const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
        if (!STRIPE_SECRET_KEY) {
          return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
        }

        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(STRIPE_SECRET_KEY);

        const session = await stripe.checkout.sessions.retrieve(s(sessionId), { expand: ["payment_intent"] });
        const pi = session.payment_intent as any;
        if (!session || session.status !== "complete") {
          return NextResponse.json({ ok: false, error: "session not complete" }, { status: 400 });
        }

        reservationId = s(session.metadata?.reservationId);
        amount = Number(session.amount_total ?? 0);
        currency = s(session.currency ?? "jpy");
        paymentIntentId = s(pi?.id ?? session.payment_intent ?? "");
      }

      if (!reservationId) {
        return NextResponse.json({ ok: false, error: "missing reservationId" }, { status: 400 });
      }

      // ---- DB 更新
      const updated = await Sentry.startSpan({ name: "checkout.confirm.db" }, async (dbSpan) => {
        const rec = await (prisma as any).reservation.update({
          where: { id: reservationId },
          data: {
            status: "CONFIRMED",
            paymentIntentId: paymentIntentId || null,
          },
        });
        dbSpan?.setAttribute?.("reservation.id", rec?.id ?? "");
        return rec;
      });

      // ---- 決済完了メール送信
      await Sentry.startSpan({ name: "checkout.confirm.notify" }, async () => {
        try {
          const built = buildPaymentSucceeded({
            reservationId,
            amount: amount ?? updated?.amount,
            currency: currency || "jpy",
            siteUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3100",
          });
          // 予約時に紐づく顧客のメールを取得（簡易）
          const customer = await (prisma as any).customer.findUnique({
            where: { id: updated.customerId },
            select: { email: true, name: true },
          });

          await sendMail({
            to: s(customer?.email ?? "test@example.com"),
            built,
            tags: { reservationId, via: "checkout.confirm" },
          });
        } catch (mailErr) {
          Sentry.captureException(mailErr, { extra: { endpoint: "checkout.confirm.notify", reservationId } });
        }
      });

      return NextResponse.json({ ok: true, reservation: updated });
    } catch (err: any) {
      Sentry.captureException(err, { extra: { endpoint: "checkout.confirm" } });
      return NextResponse.json({ ok: false, error: err?.message ?? "confirm error" }, { status: 500 });
    }
  });
}
