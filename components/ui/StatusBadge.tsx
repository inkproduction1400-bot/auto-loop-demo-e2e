'use client';

import React from 'react';
import type { ReservationStatus } from '@/lib/types';

const colorByStatus: Record<ReservationStatus, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800 ring-yellow-200',
  CONFIRMED: 'bg-green-100 text-green-800 ring-green-200',
  CANCELED:  'bg-rose-100 text-rose-800 ring-rose-200',
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const cls = colorByStatus[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}
