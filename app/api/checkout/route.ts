// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const BASE =
  (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100').replace(/\/+$/, '');

// ── ヘルパ
function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

// POST /api/checkout
// E2E_STRIPE_MOCK=1 のときは Stripe を呼ばず「見た目だけそれっぽいURL」を返す
export async function POST(req: Request) {
  // 1) モック（CI/ローカル切り替え）
  if (process.env.E2E_STRIPE_MOCK === '1') {
    const mockUrl =
      'https://checkout.stripe.com/pay/cs_test_mock_' + Math.random().toString(36).slice(2);
    return NextResponse.json({ url: mockUrl });
  }

  // 2) 実 Stripe（テストキー）呼び出し
  if (!STRIPE_SECRET_KEY) return jsonError('Missing STRIPE_SECRET_KEY on server', 500);

  // ★ここがポイント：短縮形ではなく、値を直接入れる
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: (Stripe as any).LATEST_API_VERSION, // 最新に追従
  });

  // リクエスト body（壊れていたら既定値で続行）
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const amount =
    Number.isFinite(body?.amount) && body.amount > 0 ? Math.round(Number(body.amount)) : 1000; // 既定: ¥1,000
  const currency = (body?.currency ?? 'jpy').toLowerCase();
  const metadata: Record<string, string> =
    body?.metadata && typeof body.metadata === 'object'
      ? Object.fromEntries(
          Object.entries(body.metadata).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
        )
      : { via: 'e2e' };

  try {
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
      // 成功/キャンセル遷移先（必要に応じて変更）
      success_url: `${BASE}/?paid=1`,
      cancel_url: `${BASE}/?canceled=1`,
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe error:', err);
    return jsonError(err?.message ?? 'Stripe API failed', 500);
  }
}
