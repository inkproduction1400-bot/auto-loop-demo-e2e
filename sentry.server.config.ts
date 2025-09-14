// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // サーバ側は非公開の DSN を推奨（環境変数名は SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN のどちらでも可）
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 1.0,           // 本番は必要に応じて下げるで御座る
  enableLogs: true,
  debug: false,

  // ★ リリース／環境タグを付与
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENV || "production",
});
