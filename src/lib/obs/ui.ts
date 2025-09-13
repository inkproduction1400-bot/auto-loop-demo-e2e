// src/lib/obs/ui.ts
'use client';
import * as Sentry from '@sentry/nextjs';

type Data = Record<string, unknown>;

export function trackUI(step: string, data: Data = {}) {
  Sentry.addBreadcrumb({
    category: 'ui',
    level: 'info',
    message: step,
    data,
  });
}
