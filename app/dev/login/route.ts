// app/dev/login/route.ts  ※ 開発用途のみ
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = url.searchParams.get('uid') ?? 'dev-user';
  const res = NextResponse.json({ ok: true, uid });
  res.cookies.set('uid', uid, { httpOnly: false, path: '/' });
  return res;
}
