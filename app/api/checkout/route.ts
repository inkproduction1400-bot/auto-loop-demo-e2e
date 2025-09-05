// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
// CI などで外部アクセスを抑止してモック返しを強制するフラグ
const E2E_STRIPE_MOCK = process.env.E2E_STRIPE_MOCK === '1';

// Next.js App Router でも Node ランタイムを明示
export const runtime = 'nodejs';

// 型
type CreateCheckoutInput = {
  amount?: number;        // 例: 1000 = ¥1,000
  currency?: string;      // 例: 'jpy'
  description?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  // まずはボディを安全に読む
  const bodyTxt = await req.text();
  const body = (bodyTxt ? JSON.parse(bodyTxt) : {}) as CreateCheckoutInput;

  // 金額などを丸めて最低金額ガード
  const amount = normalizeAmount(body.amount);
  const currency = (body.currency ?? 'jpy').toLowerCase();
  const description = body.description ?? 'Reservation Fee';
  const metadata = toStringRecord({
    ...(body.metadata ?? {}),
    via: 'e2e',
  });

  // CI ではモック返し（外部通信なし）
  if (E2E_STRIPE_MOCK || !STRIPE_SECRET_KEY) {
    const mockUrl =
      'https://checkout.stripe.com/pay/cs_test_mock_' +
      Math.random().toString(36).slice(2);
    return NextResponse.json({ url: mockUrl });
  }

  // ここから実 Stripe（テストキー）
  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
    });

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
      success_url: process.env.NEXT_PUBLIC_BASE_URL
        ? `${stripTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL)}/?status=success`
        : 'http://localhost:3100/?status=success',
      cancel_url: process.env.NEXT_PUBLIC_BASE_URL
        ? `${stripTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL)}/?status=cancel`
        : 'http://localhost:3100/?status=cancel',
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    // 失敗時も HTML ではなく JSON を返す（テストがパース可能）
    return NextResponse.json(
      {
        error: 'Failed to create Stripe Checkout session',
        detail: (err as Error)?.message,
      },
      { status: 500 }
    );
  }
}

// GET で叩かれても 405 等にせず JSON 返す（誤爆時の見やすさ重視）
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST /api/checkout' },
    { status: 405 }
  );
}

// ===== helpers =====
function normalizeAmount(v?: number) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return 1000;
  return Math.max(50, Math.round(n!)); // 最低 50 を保証
}

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, '');
}

function toStringRecord(
  obj?: Record<string, unknown>
): Record<string, string> | undefined {
  if (!obj) return undefined;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
  );
}
