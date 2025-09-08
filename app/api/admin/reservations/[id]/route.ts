// app/api/admin/reservations/[id]/route.ts
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/reservations/:id
 * - まずはビルドを通すための最小実装（ダミー）
 * - 後で Prisma 等に差し替え可
 */
export async function GET(_req: Request, { params }: any) {
  const id = params?.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    reservation: {
      id,
      name: 'Sample',
      email: 'sample@example.com',
      amount: 0,
      status: 'mock',
    },
  });
}

/**
 * DELETE /api/admin/reservations/:id
 * - まずはビルドを通すための最小実装（ダミー）
 */
export async function DELETE(_req: Request, { params }: any) {
  const id = params?.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    deleted: true,
    id,
  });
}
