// src/lib/obs/tracing.ts

/**
 * 軽量 Span 型（Sentry が無くても使える）
 */
export type SpanLite = {
    setAttribute: (key: string, value: string | number | boolean) => void;
    end?: () => void;
  };
  
  const noopSpan: SpanLite = { setAttribute: () => {} };
  
  /** Sentry の startSpan だけを表す最小型 */
  type StartSpan = <T>(
    opts: { name: string },
    cb: (span: unknown) => Promise<T>
  ) => Promise<T>;
  
  function setAttr(span: unknown, k: string, v: string | number | boolean) {
    try {
      (span as { setAttribute?: (key: string, val: typeof v) => void }).setAttribute?.(k, v);
    } catch {
      /* noop */
    }
  }
  
  function endSpan(span: unknown) {
    try {
      (span as { end?: () => void }).end?.();
    } catch {
      /* noop */
    }
  }
  
  /**
   * Sentry が存在すれば startSpan で実行、無ければ no-op。
   */
  export async function withSpan<T>(
    name: string,
    fn: (span: SpanLite) => Promise<T>
  ): Promise<T> {
    try {
      const mod = await import('@sentry/nextjs');
      const startSpan = (mod as { startSpan: StartSpan }).startSpan;
  
      return startSpan({ name }, async (rawSpan) => {
        const safeSpan: SpanLite = {
          setAttribute: (k, v) => setAttr(rawSpan, k, v),
          end: () => endSpan(rawSpan),
        };
        return fn(safeSpan);
      });
    } catch {
      // Sentry 未導入環境では no-op
      return fn(noopSpan);
    }
  }
  