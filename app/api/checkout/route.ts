// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// 既定は 3000（運用で NEXT_PUBLIC_BASE_URL を上書き）
const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// 共通：JSON エラー応答
function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// ---- helpers
function toStringRecord(obj: Record<string, unknown> | undefined): Record<string, string> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
  );
}

/** Prisma を遅延 import（prisma generate 未実行でもビルドを通す） */
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
 * POST /api/checkout
 * 予約IDを受け取り、サーバ側で予約を取得して金額を確定してからチェックアウトURLを返す
 * - モック条件（いずれか true で発火）
 *   - ENV:   E2E_STRIPE_MOCK=1
 *   - Query: ?mock=1
 *   - Header:x-e2e-mock: 1
 *
 * 受信 payload 例:
 * {
 *   "metadata": { "reservationId": "xxxxx", "via": "ui", "outcome": "success|decline" }
 * }
 */
export async function POST(req: Request) {
  return await Sentry.startSpan({ name: "checkout.process" }, async (rootSpan) => {
    // ---- リクエストボディ parse
    let body: any = {};
    try {
      body = await Sentry.startSpan({ name: "checkout.parse" }, async (parseSpan) => {
        const json = await req.json().catch(() => ({}));
        parseSpan?.setAttribute?.("payload.size", JSON.stringify(json).length);
        return json;
      });
    } catch {
      body = {};
    }

    // ---- モック判定
    const url = new URL(req.url);
    const useMock =
      process.env.E2E_STRIPE_MOCK === "1" ||
      url.searchParams.get("mock") === "1" ||
      req.headers.get("x-e2e-mock") === "1";

    // ---- 予約IDを抽出（metadata 優先、クエリ/直下も許容）
    const reservationId: string | undefined =
      body?.metadata?.reservationId ??
      body?.reservationId ??
      url.searchParams.get("reservationId") ??
      undefined;

    if (!reservationId) {
      return jsonError("reservationId is required", 400);
    }

    // ---- 予約をDBから取得して金額を確定
    const prisma = await getPrisma();
    if (!prisma) {
      Sentry.captureMessage("Prisma not available on checkout", "error");
      return jsonError("server not ready", 503);
    }

    const loaded = await Sentry.startSpan(
      { name: "checkout.load_reservation" },
      async (span) => {
        const r = await (prisma as any).reservation.findUnique({
          where: { id: String(reservationId) },
          select: { id: true, amount: true },
        });
        if (!r) throw new Error("reservation_not_found");
        span?.setAttribute?.("reservation.id", r.id);
        span?.setAttribute?.("reservation.amount", r.amount);
        return { reservation: r, amount: Number(r.amount || 0), currency: "jpy" as const };
      }
    ).catch((err) => {
      if (String(err?.message) === "reservation_not_found") return null;
      throw err;
    });

    if (!loaded) {
      try {
        await (prisma as any).$disconnect?.();
      } catch {}
      return jsonError("reservation not found", 404);
    }

    const { amount, currency } = loaded;
    if (!Number.isFinite(amount) || amount <= 0) {
      try {
        await (prisma as any).$disconnect?.();
      } catch {}
      return jsonError("invalid reservation amount", 400);
    }

    // ---- metadata（サーバ側で最終確定）
    const metadata: Record<string, string> = {
      ...toStringRecord(body?.metadata ?? {}),
      reservationId: String(reservationId),
      via: (body?.metadata?.via as string) ?? "api",
    };

    // ---- モック分岐
    if (useMock) {
      const res = await Sentry.startSpan({ name: "checkout.mock" }, async (mockSpan) => {
        const outcome = (metadata.outcome || "").toLowerCase();
        const status = outcome === "decline" || outcome === "cancel" ? "cancel" : "success";
        mockSpan?.setAttribute?.("mock.status", status);
        mockSpan?.setAttribute?.("reservation.id", reservationId);

        const params = new URLSearchParams({
          amount: String(amount),
          currency,
          status,
        });

        // ★ reservationId を引き継ぎ（後続の完了ハンドラ等で使える）
        params.set("reservationId", String(reservationId));

        const mockUrl = `${base}/mock-checkout?${params.toString()}`;
        return NextResponse.json({ url: mockUrl }, { status: 200 });
      });

      try {
        await (prisma as any).$disconnect?.();
      } catch {}
      return res;
    }

    // ---- 実 Stripe 呼び出し
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
    if (!STRIPE_SECRET_KEY) {
      try {
        await (prisma as any).$disconnect?.();
      } catch {}
      Sentry.captureMessage("STRIPE_SECRET_KEY missing", "error");
      return jsonError("Missing STRIPE_SECRET_KEY on server", 500);
    }

    // 動的 import（モック時に Stripe を読み込まない）
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    try {
      const session = await Sentry.startSpan(
        { name: "checkout.stripe.createSession" },
        async (stripeSpan) => {
          stripeSpan?.setAttribute?.("amount", amount);
          stripeSpan?.setAttribute?.("currency", currency);
          stripeSpan?.setAttribute?.("reservation.id", reservationId);

          return await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency,
                  product_data: { name: "Reservation Fee" },
                  unit_amount: Math.round(amount),
                },
                quantity: 1,
              },
            ],
            metadata,
            success_url: `${base}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${base}/?status=cancel`,
          });
        }
      );

      return NextResponse.json({ url: session.url }, { status: 200 });
    } catch (err: any) {
      Sentry.captureException(err, { extra: { endpoint: "checkout.stripe.createSession" } });
      return jsonError("Stripe create session failed", 500);
    } finally {
      try {
        await (prisma as any).$disconnect?.();
      } catch {
        /* noop */
      }
      rootSpan?.end?.();
    }
  });
}

// GET（疎通チェック用）
export async function GET() {
  return await Sentry.startSpan({ name: "checkout.get" }, async () => {
    if (process.env.E2E_STRIPE_MOCK === "1") {
      return NextResponse.json({ ok: true, mock: true });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return jsonError("Missing STRIPE_SECRET_KEY on server", 500);
    }
    return NextResponse.json({ ok: true, mock: false });
  });
}
