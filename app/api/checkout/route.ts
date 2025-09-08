// app/api/checkout/route.ts
import { NextResponse } from 'next/server';

const base = (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100').replace(/\/+$/, '');

// 共通：JSON エラー応答
function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

// ---- helpers
function toStringRecord(obj: Record<string, unknown> | undefined): Record<string, string> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  );
}

/**
 * POST /api/checkout
 * - モック条件（いずれか true で発火）
 *   - ENV:   E2E_STRIPE_MOCK=1
 *   - Query: ?mock=1
 *   - Header:x-e2e-mock: 1
 */
export async function POST(req: Request) {
  // 受信ボディ（壊れていても既定値で進む）
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const amount =
    Number.isFinite(body?.amount) && body.amount > 0 ? Math.round(Number(body.amount)) : 1000;
  const currency = (String(body?.currency ?? 'jpy') || 'jpy').toLowerCase();
  const metadata: Record<string, string> = toStringRecord({
    ...(body?.metadata ?? {}),
    via: (body?.metadata?.via as string) ?? 'api',
  });

  // ---- モック判定（リクエスト時に必ず評価するのがポイント）
  const url = new URL(req.url);
  const useMock =
    process.env.E2E_STRIPE_MOCK === '1' ||
    url.searchParams.get('mock') === '1' ||
    req.headers.get('x-e2e-mock') === '1';

  if (useMock) {
    // outcome が "success" / "decline" などで渡ってきた場合はステータスに反映
    const outcome = (metadata.outcome || '').toLowerCase();
    const status = outcome === 'decline' || outcome === 'cancel' ? 'cancel' : 'success';

    const params = new URLSearchParams({
      amount: String(amount),
      currency,
      status, // mock-checkout 側で ?status=success|cancel を見る
    });

    // __mock/checkout → mock-checkout に修正
    const mockUrl = `${base}/mock-checkout?${params.toString()}`;
    return NextResponse.json({ url: mockUrl }, { status: 200 });
  }

  // ---- 実 Stripe 呼び出し（モックでない場合のみ動的 import）
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
  if (!STRIPE_SECRET_KEY) {
    return jsonError('Missing STRIPE_SECRET_KEY on server', 500);
  }

  // 動的 import（モック時に Stripe を読み込まない）
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

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
      metadata,
      success_url: `${base}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?status=cancel`,
    });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('[Stripe] create session failed:', err?.message ?? err);
    return jsonError('Stripe create session failed', 500);
  }
}

// GET（疎通チェック用）
export async function GET(req: Request) {
  // モック時はキーが無くても OK
  if (process.env.E2E_STRIPE_MOCK === '1') {
    return NextResponse.json({ ok: true, mock: true });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return jsonError('Missing STRIPE_SECRET_KEY on server', 500);
  }
  return NextResponse.json({ ok: true, mock: false });
}
