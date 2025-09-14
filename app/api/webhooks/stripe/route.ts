// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs"; // Stripe SDK は Edge では不可で御座る

/**
 * Prisma を遅延 import（ビルド安全のため）
 */
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

/**
 * Stripe Webhook 受信
 * - checkout.session.completed をハンドリング
 * - metadata.reservationId を元に Reservation を CONFIRMED 化
 */
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();

  // --- モック運用（E2E_STRIPE_MOCK=1）は署名検証をスキップ可能で御座る
  const isMock = process.env.E2E_STRIPE_MOCK === "1";

  // --- 本番（署名検証あり）
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";

  if (!isMock && (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY)) {
    return NextResponse.json(
      { ok: false, error: "missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  let event: any;

  try {
    if (isMock) {
      // モック時は生 JSON をそのまま使う（curl/Stripe CLI で投げやすい）
      const json = await req.json();
      event = json;
    } else {
      // 本番：署名検証（RAW BODY が必要）
      const buf = await req.text();
      const sig = req.headers.get("stripe-signature") || "";

      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });

      event = stripe.webhooks.constructEvent(buf, sig, STRIPE_WEBHOOK_SECRET);
    }
  } catch (err: any) {
    Sentry.captureException(err, { extra: { endpoint: "stripe.webhook.parse" } });
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  // ---- イベント種別で分岐
  if (event.type === "checkout.session.completed") {
    return await Sentry.startSpan({ name: "webhook.checkout.completed" }, async (span) => {
      try {
        const session = event.data?.object ?? {};
        const reservationId: string | undefined = session.metadata?.reservationId;
        const paymentIntentId: string | undefined =
          (typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id) || undefined;

        if (!reservationId) {
          Sentry.captureMessage("webhook: missing reservationId", {
            level: "warning",
            extra: { sessionId: session.id },
          });
          return NextResponse.json(
            { ok: false, error: "reservationId missing" },
            { status: 200 } // 200 で ACK（再送嵌りを避ける）
          );
        }

        if (!prisma) {
          Sentry.captureMessage("prisma not available in webhook", { level: "error" });
          return NextResponse.json({ ok: false, error: "db unavailable" }, { status: 500 });
        }

        // 予約を CONFIRMED に更新
        const updated = await prisma.reservation.update({
          where: { id: reservationId },
          data: {
            status: "CONFIRMED",
            paymentIntentId: paymentIntentId ?? "stripe_webhook",
          },
        });

        span.setAttribute("reservation.id", updated.id);
        span.setAttribute("reservation.status", updated.status);

        // （任意）ここで支払い完了メール sendMail(buildPaymentSucceeded(...)) を呼んでも良いで御座る

        return NextResponse.json({ ok: true, reservationId: updated.id, status: updated.status });
      } catch (err: any) {
        Sentry.captureException(err, { extra: { endpoint: "webhook.checkout.completed" } });
        // Stripe Webhook は再送されるので 500 で返す
        return NextResponse.json({ ok: false, error: err?.message ?? "failed" }, { status: 500 });
      } finally {
        try {
          await (prisma as any)?.$disconnect?.();
        } catch {/* noop */}
        (span as any)?.end?.();
      }
    });
  }

  // 未対応イベントは 200 ACK（必要に応じて拡張）
  return NextResponse.json({ ok: true, ignored: event.type }, { status: 200 });
}
