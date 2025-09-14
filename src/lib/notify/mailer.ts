// src/lib/notify/mailer.ts
import * as Sentry from "@sentry/nextjs";
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import type { MailBuilt } from "./templates";

export type MailPayload = {
  to: string;
  cc?: string | string[];   // ★ 追加
  bcc?: string | string[];  // ★ 追加
  subject?: string;
  html?: string;
  text?: string;
  built?: MailBuilt; // テンプレで組んだ内容を渡せる
  tags?: Record<string, string | number | boolean>;
};

// ===== env =====
const SMTP_HOST =
  process.env.MAIL_SMTP_HOST || process.env.SMTP_HOST || "127.0.0.1";
const SMTP_PORT = Number(
  process.env.MAIL_SMTP_PORT || process.env.SMTP_PORT || 1025
);
const SMTP_SECURE =
  String(process.env.MAIL_SMTP_SECURE ?? process.env.SMTP_SECURE ?? "false")
    .toLowerCase()
    .trim() === "true";
const SMTP_USER = process.env.MAIL_SMTP_USER || process.env.SMTP_USER || "";
const SMTP_PASS = process.env.MAIL_SMTP_PASS || process.env.SMTP_PASS || "";
const MAIL_FROM =
  process.env.MAIL_FROM || process.env.SMTP_FROM || "no-reply@example.com";

// ===== transporter (singleton) =====
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // 465→true, それ以外→false
    auth:
      SMTP_USER || SMTP_PASS
        ? { user: SMTP_USER || undefined, pass: SMTP_PASS || undefined }
        : undefined,
  });

  // dev のみ verify & ざっくりログ（失敗してもアプリは落とさない）
  if (process.env.NODE_ENV !== "production") {
    transporter.verify((err, ok) => {
      // eslint-disable-next-line no-console
      console.log(
        "[mailer] verify",
        err ? `error=${err.message}` : "ok",
        `(${ok ? "reachable" : "unreachable"})`
      );
    });
  }

  return transporter;
}

// ===== send =====
export async function sendMail(payload: MailPayload) {
  return Sentry.startSpan({ name: "notification.email.send" }, async (span) => {
    const t = getTransporter();

    try {
      const subject = payload.built?.subject ?? payload.subject ?? "(no subject)";
      const html = payload.built?.html ?? payload.html ?? "";
      const text = payload.built?.text ?? payload.text ?? "";

      const mailOptions: SendMailOptions = {
        from: MAIL_FROM,
        to: payload.to,
        cc: payload.cc,   // ★ ccを追加
        bcc: payload.bcc, // ★ bccを追加
        subject,
        html,
        text,
        // Mailpit でも確認できるカスタムヘッダ
        headers: payload.tags
          ? Object.fromEntries(
              Object.entries(payload.tags).map(([k, v]) => [
                `X-App-Tag-${k}`,
                String(v),
              ])
            )
          : undefined,
      };

      // tracing attributes
      span.setAttribute("mail.to", payload.to);
      if (payload.cc) span.setAttribute("mail.cc", String(payload.cc));
      if (payload.bcc) span.setAttribute("mail.bcc", String(payload.bcc));
      span.setAttribute("mail.subject", subject);
      span.setAttribute("mail.host", SMTP_HOST);
      span.setAttribute("mail.port", String(SMTP_PORT));

      const info = await t.sendMail(mailOptions);

      span.setAttribute("mail.provider", "smtp");
      span.setAttribute("mail.messageId", info.messageId ?? "");

      Sentry.addBreadcrumb({
        category: "mail",
        level: "info",
        message: "mail.sent",
        data: {
          to: payload.to,
          cc: payload.cc,
          bcc: payload.bcc,
          subject,
          id: info.messageId ?? "",
        },
      });

      // dev のみ詳細ログ
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[mailer] sent:", info.envelope, info.messageId);
      }

      return { ok: true, messageId: info.messageId };
    } catch (err) {
      Sentry.captureException(err, { extra: { endpoint: "notification.email.send" } });
      throw err;
    } finally {
      span.end?.();
    }
  });
}
