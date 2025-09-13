// app/api/admin/export/customers.csv/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ---------- 共通: 配列→CSV ---------- */
function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  headerOrder: (keyof T)[]
): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = headerOrder.join(",");
  const body = rows.map((r) => headerOrder.map((k) => esc(r[k])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

/* ---------- Row 型（暗黙 any 防止） ---------- */
type CustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  _count: { reservations: number };
};

export async function GET(req: Request) {
  return Sentry.startSpan({ name: "admin_export.customers.csv" }, async (span) => {
    try {
      const url = new URL(req.url);
      const limit = Math.min(10_000, Math.max(1, Number(url.searchParams.get("limit") ?? 1000)));
      span.setAttribute("rows.limit", String(limit));

      const rows = (await prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { _count: { select: { reservations: true } } },
      })) as unknown as CustomerRow[];

      const mapped = rows.map((c) => ({
        customer_id: c.id,
        name: c.name ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        created_at: c.createdAt.toISOString(),
        reservations_count: c._count?.reservations ?? 0,
      }));

      const csv = toCSV(mapped, [
        "customer_id",
        "name",
        "email",
        "phone",
        "created_at",
        "reservations_count",
      ]);

      const res = new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="customers.csv"`,
        },
      });
      return res;
    } catch (err) {
      Sentry.captureException(err, { extra: { endpoint: "admin_export.customers.csv" } });
      return NextResponse.json({ ok: false, error: "export_failed" }, { status: 500 });
    }
  });
}
