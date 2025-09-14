// src/lib/obs/logger.ts
import * as Sentry from '@sentry/nextjs';

export type Context = Record<string, unknown>;

export function logError(err: unknown, ctx: Context = {}): void {
  Sentry.addBreadcrumb({ category: 'error', level: 'error', message: String(err), data: ctx });
  Sentry.captureException(err, { extra: ctx });
  // eslint-disable-next-line no-console
  console.error('[ERROR]', err, JSON.stringify(ctx));
}

/** Sentry Span に付けられる値へ正規化（長文は切り詰め） */
function toSpanData(data: Context = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else {
      try {
        const s = JSON.stringify(v);
        out[k] = s.length > 500 ? s.slice(0, 500) + '…' : s;
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

/**
 * 任意処理を Sentry の Span で計測。
 * - オプションは `name` のみ
 * - コールバック中に Active Span を取り出して属性を set する
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T> | T,
  data: Context = {},
): Promise<T> {
  return await Sentry.startSpan({ name }, async () => {
    const span = Sentry.getActiveSpan();
    if (span) {
      const attrs = toSpanData(data);
      for (const [k, v] of Object.entries(attrs)) {
        // 型定義の差分を気にせずセット（SDK 側は string|number|boolean を受け付ける）
        span.setAttribute(k, v);
      }
    }
    return await fn();
  });
}
