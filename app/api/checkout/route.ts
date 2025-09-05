// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string | undefined;

// 共通ユーティリティ
function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
function normalizeAmount(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return 1000; // デフォルト ¥1,000
  return Math.round(n);
}
function toStringRecord(
  obj?: Record<string, unknown>
): Record<string, string> | undefined {
  if (!obj) return undefined;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
  );
}

// 実体（実際に export するのは最後）
let POST_impl: (req: Request) => Promise<Response>;
let GET_impl: (req: Request) => Promise<Response>;

if (!STRIPE_SECRET_KEY) {
  // ✅ 秘密鍵が無い環境でも HTML エラーにせず JSON を返す
  POST_impl = async () => jsonError('Missing STRIPE_SECRET_KEY on server', 500);
  GET_impl = async () => jsonError('Missing STRIPE_SECRET_KEY on server', 500);
} else {
  // ✅ 正常系（テストモード鍵を想定）
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
  });

  type CreateCheckoutInput = {
    amount?: number; // 例: 1000 = ¥1,000
    currency?: string; // 例: 'jpy'
    description?: string;
    metadata?: Record<string, unknown>;
  };

  POST_impl = async (req: Request) => {
    try {
      const bodyText = await req.text();
      const body = bodyText ? (JSON.parse(bodyText) as CreateCheckoutInput) : {};
      const amount = normalizeAmount(body.amount ?? 1000);
      const currency = (body.currency ?? 'jpy').toLowerCase();
      if (!Number.isInteger(amount) || amount < 50) {
        return jsonError('Invalid amount; amount must be integer >= 50', 400);
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: 'Reservation Fee' },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100'}/?paid=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100'}/?paid=0`,
        metadata: toStringRecord(body.metadata),
      });

      return NextResponse.json({ url: session.url }, { status: 200 });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as any).message)
          : 'unknown error';
      return jsonError(msg, 500);
    }
  };

  // 任意のヘルスチェック
  GET_impl = async () => NextResponse.json({ ok: true });
}

// ✅ ここでのみトップレベル export
export const POST = (req: Request) => POST_impl(req);
export const GET = (req: Request) => GET_impl(req);
