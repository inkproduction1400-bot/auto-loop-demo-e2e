// app/api/reservations/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { sendMail } from "../../../src/lib/notify/mailer";
import { buildReservationConfirmed } from "../../../src/lib/notify/templates";

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

/** ざっくり PII マスク（メール/電話/カード番号等を伏せる） */
function maskPII(input: any) {
  try {
    const json = JSON.parse(JSON.stringify(input));
    if (json?.email) json.email = "<redacted>";
    if (json?.phone) json.phone = "<redacted>";
    if (json?.cardNumber) json.cardNumber = "<redacted>";
    return json;
  } catch {
    return "<unserializable>";
  }
}

/** --- 認証ヘルパ（NextAuth なし版） --- 
 * 優先順：
 * 1) ヘッダ x-user-id: <UID>
 * 2) Authorization: Bearer <UID>（ローカル検証用）
 * 3) Cookie uid=<UID>
 * 取得できなければ null
 */
function getUserIdFromRequest(req: Request): string | null {
  try {
    // 1) x-user-id
    const h = req.headers.get("x-user-id");
    if (h && h.trim()) return h.trim();

    // 2) Authorization: Bearer <uid>
    const auth = req.headers.get("authorization");
    if (auth && /^Bearer\s+/i.test(auth)) {
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token) return token;
    }

    // 3) cookie: uid=...
    const cookie = req.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)uid=([^;]+)/);
    if (m && m[1]) return decodeURIComponent(m[1]);

    return null;
  } catch {
    return null;
  }
}

/** --- 管理者通知: 宛先ユーティリティ --- */
function parseCsvEmails(v: string | undefined | null): string[] {
  if (!v) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
const ADMIN_TO = parseCsvEmails(
  process.env.ADMIN_NOTIFY_TO || process.env.MAIL_ADMIN_TO
);
const ADMIN_CC = parseCsvEmails(process.env.ADMIN_NOTIFY_CC);
const ADMIN_BCC = parseCsvEmails(process.env.ADMIN_NOTIFY_BCC);

/** --- zod: 予約作成スキーマ（Prisma必須項目に合わせて調整） --- */
const ReservationCreateSchema = z.object({
  customerEmail: z.string().email(),
  /** Customer が name 必須のため、任意で受け取り・未指定時は email ローカル部で補完する */
  customerName: z.string().min(1).max(200).optional(),
  date: z.string().min(1),                // "2025-09-15" など（必要なら z.coerce.date() へ）
  slot: z.string().min(1),                // 例: "10:00"
  adultCount: z.number().int().min(0).default(1),
  studentCount: z.number().int().min(0).default(0),
  childCount: z.number().int().min(0).default(0),
  infantCount: z.number().int().min(0).default(0),
  amount: z.number().int().min(0),        // 例: 5000
  status: z.enum(["PENDING","CONFIRMED","CANCELLED"]).optional().default("PENDING"),
  notes: z.string().max(500).optional(),  // Prismaのカラム名に合わせて notes
});
type ReservationCreateInput = z.infer<typeof ReservationCreateSchema>;

/** クエリ変換ヘルパ */
function toInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}
function toSort(v: string | null) {
  const raw = (v ?? "-createdAt").trim();      // 例: -createdAt / createdAt
  const field = raw.replace(/^-/, "");
  const order = raw.startsWith("-") ? "desc" : "asc";
  return { field, order } as const;
}

/**
 * GET /api/reservations
 * - 予約一覧を返す（ページング/ソート対応）
 * - scope=me の場合は認証ユーザーのみ（ヘッダ/トークン/クッキーからUID取得）
 * - Prisma が無ければ空配列を返す
 * - クエリ: ?scope=me&page=1&limit=20&sort=-createdAt
 */
export async function GET(req: Request) {
  const prisma = await getPrisma();

  if (!prisma) {
    Sentry.addBreadcrumb({
      category: "db",
      level: "warning",
      message: "prisma not available (GET)",
    });
    return NextResponse.json(
      {
        ok: true,
        reservations: [],
        meta: { page: 1, limit: 0, total: 0, sort: "-createdAt", scope: "none" },
        note: "prisma not available (returning mock data)",
      },
      { status: 200 }
    );
  }

  return await Sentry.startSpan({ name: "reservation.list" }, async (rootSpan) => {
    try {
      const url = new URL(req.url);
      const page  = Math.max(1, toInt(url.searchParams.get("page"), 1));
      const limit = Math.min(100, Math.max(1, toInt(url.searchParams.get("limit"), 20)));
      const { field, order } = toSort(url.searchParams.get("sort"));
      const skip = (page - 1) * limit;
      const scope = url.searchParams.get("scope"); // "me" or undefined("all")

      // --- scope=me の場合はUID必須（メール or customerId の両対応）---
      let where: Record<string, any> = {};
      if (scope === "me") {
        const uid = getUserIdFromRequest(req);
        if (!uid) {
          return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const looksLikeEmail = /@/.test(uid);
        // uid が email なら customer.email で、そうでなければ customerId で絞る
        where = looksLikeEmail ? { customer: { email: uid } } : { customerId: uid };

        Sentry.addBreadcrumb({
          category: "auth",
          level: "info",
          message: "scope=me resolved",
          data: { by: looksLikeEmail ? "email" : "customerId", uid }
        });
      }

      // 子スパン: DB クエリ
      const data = await Sentry.startSpan(
        { name: "reservation.list.db" },
        async (dbSpan) => {
          dbSpan?.setAttribute?.("limit", limit);
          dbSpan?.setAttribute?.("page", page);
          dbSpan?.setAttribute?.("sort.field", field);
          dbSpan?.setAttribute?.("sort.order", order);
          dbSpan?.setAttribute?.("scope", scope ?? "all");

          const [items, total] = await Promise.all([
            (prisma as any).reservation.findMany({
              where,
              take: limit,
              skip,
              orderBy: { [field]: order },
              include: { customer: true }, // join しておくとフロントで名前/メールを使いやすい
            }),
            (prisma as any).reservation.count({ where }),
          ]);

          dbSpan?.setAttribute?.("result.count", items?.length ?? 0);
          dbSpan?.setAttribute?.("result.total", total);
          return { items, total };
        }
      );

      Sentry.addBreadcrumb({
        category: "db",
        level: "info",
        message: "reservation.list:success",
        data: { count: data.items?.length ?? 0 },
      });

      return NextResponse.json({
        ok: true,
        reservations: data.items,
        meta: { page, limit, total: data.total, sort: `${order === "desc" ? "-" : ""}${field}`, scope: scope ?? "all" },
      });
    } catch (err: any) {
      Sentry.addBreadcrumb({
        category: "db",
        level: "error",
        message: "reservation.list:fail",
      });
      Sentry.captureException(err, { extra: { endpoint: "reservation.list" } });
      return NextResponse.json(
        { ok: false, error: err?.message ?? "DB error" },
        { status: 500 }
      );
    } finally {
      rootSpan?.end?.();
      try {
        await (prisma as any).$disconnect();
      } catch {
        /* noop */
      }
    }
  });
}

/**
 * POST /api/reservations
 * - 新しい予約を作成（zod 検証＋正規化）
 * - Prisma が無ければ 503 を返す
 * - 顧客へ確認メール + 管理者へも通知（env: ADMIN_NOTIFY_*）
 */
export async function POST(req: Request) {
  const prisma = await getPrisma();

  if (!prisma) {
    Sentry.addBreadcrumb({
      category: "db",
      level: "warning",
      message: "prisma not available (POST)",
    });
    return NextResponse.json(
      { ok: false, error: "prisma not available" },
      { status: 503 }
    );
  }

  return await Sentry.startSpan({ name: "reservation.create" }, async (rootSpan) => {
    try {
      // 子スパン: リクエスト parse
      const bodyRaw = await Sentry.startSpan(
        { name: "reservation.create.parse" },
        async (parseSpan) => {
          const json = await req.json().catch(() => ({}));
          parseSpan?.setAttribute?.("payload.size", JSON.stringify(json).length);
          // PII マスクした内容を breadcrumb に残す
          Sentry.addBreadcrumb({
            category: "api",
            level: "info",
            message: "reservation.create:request",
            data: { body: maskPII(json) },
          });
          return json;
        }
      );

      // 子スパン: validate（zod）
      const parsed = await Sentry.startSpan(
        { name: "reservation.create.validate" },
        async () => {
          const result = ReservationCreateSchema.safeParse(bodyRaw);
          if (!result.success) {
            Sentry.captureMessage("reservation.create:validation_error", {
              level: "warning",
              extra: { issues: result.error.issues },
            });
            throw new ValidationError(result.error.issues);
          }
          return result.data as ReservationCreateInput;
        }
      );

      // Customer.name の補完（未指定なら email ローカル部）
      const fallbackName =
        parsed.customerName && parsed.customerName.trim().length > 0
          ? parsed.customerName.trim()
          : String(parsed.customerEmail).split("@")[0];

      // 子スパン: DB create（Prisma に正規化して渡す）
      const created = await Sentry.startSpan(
        { name: "reservation.create.db" },
        async (dbSpan) => {
          const data = {
            date: new Date(parsed.date),
            slot: parsed.slot,
            adultCount: parsed.adultCount,
            studentCount: parsed.studentCount,
            childCount: parsed.childCount,
            infantCount: parsed.infantCount,
            amount: parsed.amount,
            status: parsed.status ?? "PENDING",
            notes: parsed.notes,
            customer: {
              connectOrCreate: {
                where: { email: parsed.customerEmail },
                create: { email: parsed.customerEmail, name: fallbackName },
              },
            },
          };
          const record = await (prisma as any).reservation.create({ data });
          dbSpan?.setAttribute?.("reservation.id", String(record?.id ?? ""));
          return record;
        }
      );

      // ★ 子スパン: メール送信（顧客 + 管理者）
      await Sentry.startSpan({ name: "reservation.create.notify" }, async (notifySpan) => {
        // 顧客向け
        const toCustomer = String(parsed.customerEmail);
        try {
          const built = buildReservationConfirmed({
            reservationId: String(created?.id ?? ""),
            customerName: fallbackName,
            date: parsed.date,
            slot: parsed.slot,
          });

          await Sentry.startSpan({ name: "reservation.create.notify.customer" }, async () => {
            await sendMail({
              to: toCustomer,
              built,
              tags: { reservationId: String(created?.id ?? ""), via: "api", kind: "customer" },
            });
            Sentry.addBreadcrumb({
              category: "mail",
              level: "info",
              message: "reservation.create:mail.customer.sent",
              data: { to: "<redacted>" },
            });
          });
        } catch (mailErr: any) {
          Sentry.captureException(mailErr, {
            extra: { endpoint: "reservation.create.notify.customer", reservationId: created?.id },
          });
          // 顧客メール失敗でも API は 201 維持
        }

        // 管理者向け（env に宛先があれば送る）
        if (ADMIN_TO.length > 0) {
          const adminTo = ADMIN_TO[0];
          const adminCc = ADMIN_CC.length ? ADMIN_CC : undefined;
          const adminBcc = ADMIN_BCC.length ? ADMIN_BCC : undefined;

          try {
            await Sentry.startSpan({ name: "reservation.create.notify.admin" }, async () => {
              // 管理者通知は subject をわかりやすく
              const subject = `【ADMIN】新規予約: ${created?.id ?? ""} / ${parsed.date} ${parsed.slot}`;
              const text = [
                `新規予約を受け付けました。`,
                ``,
                `予約ID: ${created?.id ?? ""}`,
                `顧客: ${fallbackName} <${toCustomer}>`,
                `日付 / 時間: ${parsed.date} ${parsed.slot}`,
                `人数: A:${parsed.adultCount} / S:${parsed.studentCount} / C:${parsed.childCount} / I:${parsed.infantCount}`,
                `金額: ${parsed.amount} JPY`,
                parsed.notes ? `メモ: ${parsed.notes}` : ``,
              ].join("\n");

              await sendMail({
                to: adminTo,
                cc: adminCc,
                bcc: adminBcc,
                subject,
                text,
                html:
                  `<pre style="font:13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">` +
                  text.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
                  `</pre>`,
                tags: {
                  reservationId: String(created?.id ?? ""),
                  via: "api",
                  kind: "admin",
                },
              });

              Sentry.addBreadcrumb({
                category: "mail",
                level: "info",
                message: "reservation.create:mail.admin.sent",
                data: { to: "<admin>", cc: adminCc?.length ?? 0, bcc: adminBcc?.length ?? 0 },
              });
            });
          } catch (adminMailErr: any) {
            Sentry.captureException(adminMailErr, {
              extra: { endpoint: "reservation.create.notify.admin", reservationId: created?.id },
            });
            // 管理者メール失敗でも API は 201 維持
          }
        } else {
          Sentry.addBreadcrumb({
            category: "mail",
            level: "info",
            message: "reservation.create:mail.admin.skipped (no ADMIN_NOTIFY_TO)",
          });
        }

        notifySpan?.end?.();
      });

      Sentry.addBreadcrumb({
        category: "db",
        level: "info",
        message: "reservation.create:success",
        data: { id: created?.id },
      });

      return NextResponse.json({ ok: true, reservation: created }, { status: 201 });
    } catch (err: any) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { ok: false, error: "validation_error", issues: err.issues },
          { status: 400 }
        );
      }
      Sentry.addBreadcrumb({
        category: "db",
        level: "error",
        message: "reservation.create:fail",
      });
      Sentry.captureException(err, { extra: { endpoint: "reservation.create" } });
      return NextResponse.json(
        { ok: false, error: err?.message ?? "DB error" },
        { status: 500 }
      );
    } finally {
      rootSpan?.end?.();
      try {
        await (prisma as any).$disconnect();
      } catch {
        /* noop */
      }
    }
  });
}

/** zod のエラーを 400 で返すための軽量 Error 型 */
class ValidationError extends Error {
  constructor(public issues: any) {
    super("validation_error");
    this.name = "ValidationError";
  }
}
