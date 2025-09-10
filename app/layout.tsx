// app/layout.tsx
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import * as Sentry from '@sentry/nextjs';
import './globals.css';

// --- Sentry の trace data を含めた metadata ---
export function generateMetadata(): Metadata {
  return {
    title: 'Auto Loop Demo',
    description: '予約システム',
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
