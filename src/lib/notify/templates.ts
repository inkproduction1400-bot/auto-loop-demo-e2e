// src/lib/notify/templates.ts
export type MailTemplateVars = Record<string, string | number | boolean | null | undefined>;

export type MailBuilt = {
  subject: string;
  text: string;
  html: string;
};

// -------------------- helpers --------------------
function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function currencyJPY(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return s(n);
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(num);
}

/** very-light HTML escaping for user-provided strings */
function escapeHtml(v?: unknown) {
  const str = s(v);
  return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * ベースレイアウト（ロゴ・ヒーロー帯・本文・CTA・脚注・最下部CTA）
 */
function baseLayout(opts: {
  logoUrl?: string;
  heroHtml?: string;
  bodyHtml: string;
  cta?: { href: string; label: string };
  footnote?: string;
  siteUrl?: string;
}): string {
  const logo = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="logo" width="64" height="64" style="display:block;border-radius:8px"/>`
    : "";

  const hero = opts.heroHtml
    ? `
    <!-- ロゴと帯の間の余白 -->
    <tr><td style="height:24px"></td></tr>
    <tr>
      <td style="padding:0 24px 24px 24px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#FFF6E0;border-radius:8px">
          <tr>
            <td style="padding:16px 18px; color:#0F172A; font:14px/1.8 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
              ${opts.heroHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  const cta = opts.cta
    ? `
    <tr>
      <td style="padding:24px">
        <a href="${opts.cta.href}" target="_blank"
           style="display:block;text-align:center;background:#F4B000;color:#111827;
                  text-decoration:none;font-weight:700;border-radius:12px;
                  padding:14px 18px;border:1px solid #e3a600">
          ${opts.cta.label}
        </a>
      </td>
    </tr>`
    : "";

  const foot = opts.footnote
    ? `
    <tr>
      <td style="padding:0 24px 24px 24px">
        <div style="color:#94A3B8;font:12px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
          ${opts.footnote}
        </div>
      </td>
    </tr>`
    : "";

  const siteBtn = opts.siteUrl
    ? `
    <tr>
      <td style="padding:24px">
        <a href="${opts.siteUrl}" target="_blank"
           style="display:block;text-align:center;background:#2563EB;color:#ffffff;
                  text-decoration:none;font-weight:700;border-radius:12px;
                  padding:14px 18px;border:1px solid #1d4ed8">
          サイトはこちら
        </a>
      </td>
    </tr>`
    : "";

  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F3F4F6;padding:24px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="width:600px;max-width:100%;background:#ffffff;border:1px solid #E5E7EB;border-radius:12px">
          <tr>
            <td style="padding:24px 24px 0 24px">
              ${logo}
            </td>
          </tr>

          ${hero}

          <tr>
            <td style="padding:0 24px">
              ${opts.bodyHtml}
            </td>
          </tr>

          ${cta}
          ${foot}
          ${siteBtn}
        </table>
      </td>
    </tr>
  </table>`;
}

// --------------- 予約確認メール ---------------
export function buildReservationConfirmed(vars: MailTemplateVars): MailBuilt {
  const id = s(vars.reservationId);
  const date = s(vars.date);
  const slot = s(vars.slot);
  const name = s(vars.customerName || "お客様");
  const amount = vars.amount != null ? currencyJPY(vars.amount) : "";

  const subject = `【予約確認】ご予約が確定しました（ID: ${id}）`;

  const text = [
    `${name} 様`,
    ``,
    `以下の内容で予約を受け付けました。`,
    ``,
    `予約ID: ${id}`,
    `日付 / 時間: ${date} ${slot}`,
    amount ? `お支払い: ${amount}` : ``,
    ``,
    `ご不明点があればこのメールにご返信ください。`,
  ].join("\n");

  const bodyHtml = `
    <h2 style="margin:8px 0 16px 0;color:#0F172A;font:700 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
      ご予約確定のご案内
    </h2>
    <p style="margin:0 0 16px 0;color:#111827;font:14px/1.9 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
      ${name} 様<br/>
      以下の内容で予約を受け付けました。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse">
      <tr>
        <td style="padding:8px 0;color:#374151;font:600 14px">予約ID</td>
        <td style="padding:8px 0;color:#111827;font:14px" align="right">${id}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#374151;font:600 14px">日付 / 時間</td>
        <td style="padding:8px 0;color:#111827;font:14px" align="right">${date} / ${slot}</td>
      </tr>
      ${amount ? `<tr><td style="padding:8px 0;color:#374151;font:600 14px">お支払い</td><td style="padding:8px 0;color:#111827;font:14px" align="right">${amount}</td></tr>` : ``}
    </table>
    <p style="margin:16px 0 0 0;color:#111827;font:14px/1.9 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
      ご不明点があればこのメールにご返信ください。
    </p>
  `;

  const html = baseLayout({
    logoUrl: s(vars.logoUrl),
    heroHtml: 'LINEでお知らせを受け取れます！<br/><a href="https://example.com/line" style="color:#2563EB;text-decoration:underline">LINE友だち追加はこちら</a>',
    bodyHtml,
    cta: vars.ctaHref ? { href: s(vars.ctaHref), label: s(vars.ctaLabel || "予約を確認する") } : undefined,
    footnote: "※このメールに心当たりがない場合は破棄してください。",
    siteUrl: s(vars.siteUrl) || "https://example.com",
  });

  return { subject, text, html };
}

// --------------- 決済完了メール ---------------
export function buildPaymentSucceeded(vars: MailTemplateVars): MailBuilt {
  const id = s(vars.reservationId);
  const name = s(vars.customerName || "お客様");
  const currency = String(s(vars.currency) || "JPY").toUpperCase();
  const amountDisplay =
    currency === "JPY" ? currencyJPY(vars.amount) : `${s(vars.amount)} ${currency}`;

  const subject = `【決済完了】ありがとうございます（予約ID: ${id}）`;

  const text = [
    `${name} 様`,
    ``,
    `決済が完了しました。`,
    ``,
    `予約ID: ${id}`,
    `金額: ${amountDisplay}`,
    ``,
    `引き続きよろしくお願いいたします。`,
  ].join("\n");

  const bodyHtml = `
    <h2 style="margin:8px 0 16px 0;color:#0F172A;font:700 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
      決済完了のご連絡
    </h2>
    <p style="margin:0 0 16px 0;color:#111827;font:14px/1.9 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
      ${name} 様<br/>
      決済が完了しました。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse">
      <tr>
        <td style="padding:8px 0;color:#374151;font:600 14px">予約ID</td>
        <td style="padding:8px 0;color:#111827;font:14px" align="right">${id}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#374151;font:600 14px">金額</td>
        <td style="padding:8px 0;color:#111827;font:14px" align="right">${amountDisplay}</td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;color:#111827;font:14px/1.9 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
      ご不明点があればこのメールにご返信ください。
    </p>
  `;

  const html = baseLayout({
    logoUrl: s(vars.logoUrl),
    heroHtml: "このメールは自動配信です。お支払いの控えとして保存してください。",
    bodyHtml,
    cta: vars.ctaHref ? { href: s(vars.ctaHref), label: s(vars.ctaLabel || "注文を確認する") } : undefined,
    footnote: "※このメールに心当たりがない場合は破棄してください。",
    siteUrl: s(vars.siteUrl) || "https://example.com",
  });

  return { subject, text, html };
}

// --------------- キャンセル通知メール ---------------
export function buildReservationCancelled(vars: MailTemplateVars): MailBuilt {
  const id = s(vars.reservationId);
  const date = s(vars.date);
  const slot = s(vars.slot);
  const name = s(vars.customerName || "お客様");
  const reason = escapeHtml(vars.reason);

  const subject = `【予約キャンセル】手続きが完了しました（ID: ${id}）`;

  const text = [
    `${name} 様`,
    ``,
    `ご依頼の予約キャンセルを承りました。`,
    ``,
    `予約ID: ${id}`,
    `日付 / 時間: ${date} ${slot}`,
    reason ? `キャンセル理由: ${s(vars.reason)}` : ``,
    ``,
    `またのご利用をお待ちしております。`,
  ].filter(Boolean).join("\n");

  const reasonHtml = reason ? `<p style="margin:0 0 12px 0;color:#111827;font:14px/1.9">キャンセル理由: ${reason}</p>` : "";

  const bodyHtml = `
    <h2 style="margin:8px 0 16px 0;color:#0F172A;font:700 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, 'Noto Sans JP', sans-serif;">
      予約キャンセルのご連絡
    </h2>
    <p style="margin:0 0 16px 0;color:#111827;font:14px/1.9">
      ${name} 様<br/>
      ご依頼の予約キャンセルを承りました。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse">
      <tr>
        <td style="padding:8px 0;color:#374151;font:600 14px">予約ID</td>
        <td style="padding:8px 0;color:#111827;font:14px" align="right">${id}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#374151;font:600 14px">日付 / 時間</td>
        <td style="padding:8px 0;color:#111827;font:14px" align="right">${date} / ${slot}</td>
      </tr>
    </table>
    ${reasonHtml}
    <p style="margin:16px 0 0 0;color:#111827;font:14px/1.9">
      ご不明点があればこのメールにご返信ください。
    </p>
  `;

  const html = baseLayout({
    logoUrl: s(vars.logoUrl),
    heroHtml: "キャンセル手続きを受け付けました。控えとして保存してください。",
    bodyHtml,
    cta: (vars.siteUrl || vars.ctaHref)
      ? { href: s(vars.ctaHref || `${vars.siteUrl}/reservations/${id}`), label: s(vars.ctaLabel || "予約詳細を確認する") }
      : undefined,
    footnote: "※このメールに心当たりがない場合は破棄してください。",
    siteUrl: s(vars.siteUrl) || "https://example.com",
  });

  return { subject, text, html };
}
export function buildAdminReservationNotice(vars: MailTemplateVars): MailBuilt {
    const id = s(vars.reservationId);
    const date = s(vars.date);
    const slot = s(vars.slot);
    const name = s(vars.customerName || "");
    const email = s(vars.customerEmail || "");
    const status = s(vars.status || "");
    const kind = s(vars.kind || "event"); // "created" | "cancelled" など
  
    const subject = `【管理者通知】予約${kind === "cancelled" ? "キャンセル" : "作成"}（ID: ${id}）`;
  
    const bodyHtml = `
      <h3 style="margin:0 0 12px 0;">予約${kind === "cancelled" ? "キャンセル" : "作成"}通知</h3>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse">
        <tr><td style="padding:6px 0;">予約ID</td><td align="right" style="padding:6px 0;">${id}</td></tr>
        <tr><td style="padding:6px 0;">状態</td><td align="right" style="padding:6px 0;">${status}</td></tr>
        <tr><td style="padding:6px 0;">日付/時間</td><td align="right" style="padding:6px 0;">${date} / ${slot}</td></tr>
        <tr><td style="padding:6px 0;">顧客</td><td align="right" style="padding:6px 0;">${name}（${email}）</td></tr>
      </table>
    `;
    const html = baseLayout({ bodyHtml, siteUrl: s(vars.siteUrl) || "https://example.com" });
    const text = `予約${kind}\nID: ${id}\n状態: ${status}\n日時: ${date} ${slot}\n顧客: ${name} ${email}`;
  
    return { subject, text, html };
  }
  