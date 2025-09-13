// app/api/admin/export/reservations.csv/route.ts
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
type ReservationRow = {
  id: string;
  createdAt: Date;
  date: Date;
  slot: string | null;
  adultCount: number | null;
  studentCount: number | null;
  childCount: number | null;
  infantCount: number | null;
  amount: number | null;
  status: string;
  customer: { id: string; name: string | null; email: string | null } | null;
};

export async function GET(req: Request) {
  return Sentry.startSpan({ name: "admin_export.reservations.csv" }, async (span) => {
    try {
      const url = new URL(req.url);
      const limit = Math.min(10_000, Math.max(1, Number(url.searchParams.get("limit") ?? 1000)));
      span.setAttribute("rows.limit", String(limit));

      const rows = (await prisma.reservation.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { customer: { select: { id: true, name: true, email: true } } },
      })) as unknown as ReservationRow[];

      const mapped = rows.map((r) => ({
        reservation_id: r.id,
        created_at: r.createdAt.toISOString(),
        date: r.date.toISOString(),
        slot: r.slot ?? "",
        party_adult: r.adultCount ?? 0,
        party_student: r.studentCount ?? 0,
        party_child: r.childCount ?? 0,
        party_infant: r.infantCount ?? 0,
        amount: r.amount ?? 0,
        status: r.status,
        customer_id: r.customer?.id ?? "",
        customer_name: r.customer?.name ?? "",
        customer_email: r.customer?.email ?? "",
      }));

      const csv = toCSV(mapped, [
        "reservation_id",
        "created_at",
        "date",
        "slot",
        "party_adult",
        "party_student",
        "party_child",
        "party_infant",
        "amount",
        "status",
        "customer_id",
        "customer_name",
        "customer_email",
      ]);

      const res = new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="reservations.csv"`,
        },
      });
      return res;
    } catch (err) {
      Sentry.captureException(err, { extra: { endpoint: "admin_export.reservations.csv" } });
      return NextResponse.json({ ok: false, error: "export_failed" }, { status: 500 });
    }
  });
}
