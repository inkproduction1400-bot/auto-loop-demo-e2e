// app/api/reservations/[id]/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { buildReservationCancelled } from "@/lib/notify/templates";
import { sendMail } from "@/lib/notify/mailer";

/**
 * Prisma を遅延 import（prisma generate 未実行でもビルドを通す）
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

/** --- 認証ヘルパ（NextAuth なし版） ---
 * 1) x-user-id ヘッダ
 * 2) Authorization: Bearer <uid>
 * 3) Cookie uid=<uid>
 */
function getUserIdFromRequest(req: Request): string | null {
  try {
    const h = req.headers.get("x-user-id");
    if (h && h.trim()) return h.trim();

    const auth = req.headers.get("authorization");
    if (auth && /^Bearer\s+/i.test(auth)) {
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token) return token;
    }

    const cookie = req.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)uid=([^;]+)/);
    if (m && m[1]) return decodeURIComponent(m[1]);

    return null;
  } catch {
    return null;
  }
}

/** --- 管理者通知宛先（環境変数） ---
 * ADMIN_NOTIFY_TO=admin@example.com
 * ADMIN_NOTIFY_CC=a@example.com,b@example.com
 * ADMIN_NOTIFY_BCC=auditor@example.com
 */
function parseCsvEmails(v: string | undefined | null): string[] {
  if (!v) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
const ADMIN_TO = parseCsvEmails(process.env.ADMIN_NOTIFY_TO || process.env.MAIL_ADMIN_TO);
const ADMIN_CC = parseCsvEmails(process.env.ADMIN_NOTIFY_CC);
const ADMIN_BCC = parseCsvEmails(process.env.ADMIN_NOTIFY_BCC);

/**
 * GET /api/reservations/[id]
 * - 本人（uid=メール or customerId）の予約のみ取得可能
 */
export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  const prisma = await getPrisma();

  if (!prisma) {
    Sentry.addBreadcrumb({
      category: "db",
      level: "warning",
      message: "prisma not available (GET /reservations/[id])",
    });
    return NextResponse.json(
      { ok: false, error: "prisma not available" },
      { status: 503 }
    );
  }

  return await Sentry.startSpan({ name: "reservation.detail" }, async (rootSpan) => {
    try {
      const id = String(context.params.id ?? "");
      const uid = getUserIdFromRequest(req);
      if (!uid) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const looksLikeEmail = /@/.test(uid);
      const where = looksLikeEmail
        ? { id, customer: { email: uid } }
        : { id, customerId: uid };

      // 予約取得 + 顧客（メール/名前）をJOIN
      const item = await Sentry.startSpan(
        { name: "reservation.detail.db" },
        async (dbSpan) => {
          dbSpan?.setAttribute?.("reservation.id", id);
          dbSpan?.setAttribute?.("owner.by", looksLikeEmail ? "email" : "customerId");
          return (prisma as any).reservation.findFirst({
            where,
            include: {
              customer: { select: { id: true, email: true, name: true } },
            },
          });
        }
      );

      if (!item) {
        return NextResponse.json({ ok: false, error: "not_found_or_forbidden" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, reservation: item });
    } catch (err: any) {
      Sentry.captureException(err, { extra: { endpoint: "reservation.detail" } });
      return NextResponse.json(
        { ok: false, error: err?.message ?? "DB error" },
        { status: 500 }
      );
    } finally {
      rootSpan?.end?.();
      try {
        await (prisma as any).$disconnect();
      } catch { /* noop */ }
    }
  });
}

/**
 * PATCH /api/reservations/[id]
 * - 本人の予約のみステータスを CANCELLED へ変更（冪等）
 * - Body: { action: "cancel", reason?: string }
 */
export async function PATCH(
  req: Request,
  context: { params: { id: string } }
) {
  const prisma = await getPrisma();

  if (!prisma) {
    Sentry.addBreadcrumb({
      category: "db",
      level: "warning",
      message: "prisma not available (PATCH /reservations/[id])",
    });
    return NextResponse.json(
      { ok: false, error: "prisma not available" },
      { status: 503 }
    );
  }

  return await Sentry.startSpan({ name: "reservation.cancel" }, async (rootSpan) => {
    try {
      const id = String(context.params.id ?? "");
      const uid = getUserIdFromRequest(req);
      if (!uid) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      // body parse
      const body = await req.json().catch(() => ({}));
      const action = String(body?.action ?? "");
      const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : undefined;

      if (action !== "cancel") {
        return NextResponse.json(
          { ok: false, error: "unsupported_action" },
          { status: 400 }
        );
      }

      // 所有者フィルタ
      const looksLikeEmail = /@/.test(uid);
      const whereOwner = looksLikeEmail
        ? { id, customer: { email: uid } }
        : { id, customerId: uid };

      // 現状取得（顧客情報も取得：メール送信用）
      const current = await (prisma as any).reservation.findFirst({
        where: whereOwner,
        include: { customer: true },
      });

      if (!current) {
        return NextResponse.json(
          { ok: false, error: "not_found_or_forbidden" },
          { status: 404 }
        );
      }

      // すでに CANCELLED なら冪等に 200 で返す
      if (current.status === "CANCELLED") {
        return NextResponse.json({ ok: true, reservation: current }, { status: 200 });
      }

      // 許可ステータス以外は拒否（必要に応じて調整）
      if (current.status !== "PENDING" && current.status !== "CONFIRMED") {
        return NextResponse.json(
          { ok: false, error: "cannot_cancel_in_current_status", status: current.status },
          { status: 409 }
        );
      }

      // 更新
      const updated = await Sentry.startSpan(
        { name: "reservation.cancel.db" },
        async (dbSpan) => {
          dbSpan?.setAttribute?.("reservation.id", id);
          return (prisma as any).reservation.update({
            where: { id: current.id },
            data: {
              status: "CANCELLED",
              // Prisma スキーマに notes がある想定：末尾へ追記
              ...(reason
                ? { notes: (current.notes ? `${current.notes}\n` : "") + `【CANCEL】${reason}` }
                : {}),
            },
            include: { customer: true },
          });
        }
      );

      Sentry.addBreadcrumb({
        category: "db",
        level: "info",
        message: "reservation.cancel:success",
        data: { id: updated.id },
      });

      // ---- キャンセル通知メール送信（非同期・失敗はAPIに影響させない）----
      (async () => {
        try {
          // 顧客向けテンプレ構築
          const built = buildReservationCancelled({
            reservationId: String(updated.id),
            customerName: updated.customer?.name ?? "",
            date: updated.date,
            slot: updated.slot,
            reason,
            siteUrl: process.env.NEXT_PUBLIC_BASE_URL,
            logoUrl: process.env.NEXT_PUBLIC_LOGO_URL,
          });

          // 顧客通知
          const to = updated.customer?.email;
          if (to) {
            await sendMail({
              to,
              subject: built.subject,
              text: built.text,
              html: built.html,
              tags: { reservationId: String(updated.id), via: "api", kind: "customer" },
            });

            Sentry.addBreadcrumb({
              category: "mail",
              level: "info",
              message: "reservation.cancel:mail.sent",
              data: { to: "<redacted>" },
            });
          }

          // （追記）管理者通知：TO/CC/BCC を .env で指定可能
          if (ADMIN_TO.length > 0) {
            const adminTo = ADMIN_TO[0];
            const adminCc = ADMIN_CC.length ? ADMIN_CC : undefined;
            const adminBcc = ADMIN_BCC.length ? ADMIN_BCC : undefined;

            const adminSubject = `【ADMIN】予約キャンセルのお知らせ（ID: ${String(updated.id)}）`;
            const adminText = [
              `予約がキャンセルされました。`,
              ``,
              `予約ID: ${String(updated.id)}`,
              `顧客: ${updated.customer?.name ?? ""} <${updated.customer?.email ?? ""}>`,
              `日付 / 時間: ${String(updated.date)} ${String(updated.slot ?? "")}`,
              reason ? `理由: ${reason}` : ``,
            ].join("\n");
            const adminHtml =
              `<pre style="font:14px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">` +
              adminText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;") +
              `</pre>`;

            await sendMail({
              to: adminTo,
              cc: adminCc,
              bcc: adminBcc,
              subject: adminSubject,
              text: adminText,
              html: adminHtml,
              tags: { reservationId: String(updated.id), via: "api", kind: "admin" },
            });

            Sentry.addBreadcrumb({
              category: "mail",
              level: "info",
              message: "reservation.cancel:mail.admin.sent",
              data: { to: "<redacted>", cc: adminCc?.length ?? 0, bcc: adminBcc?.length ?? 0 },
            });
          }
        } catch (mailErr: any) {
          Sentry.captureException(mailErr, {
            extra: { endpoint: "reservation.cancel.mail", reservationId: String(updated.id) },
          });
        }
      })();
      // --------------------------------------------------------------------

      return NextResponse.json({ ok: true, reservation: updated }, { status: 200 });
    } catch (err: any) {
      Sentry.captureException(err, { extra: { endpoint: "reservation.cancel" } });
      return NextResponse.json(
        { ok: false, error: err?.message ?? "DB error" },
        { status: 500 }
      );
    } finally {
      rootSpan?.end?.();
      try {
        await (prisma as any).$disconnect();
      } catch { /* noop */ }
    }
  });
}
