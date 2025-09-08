'use client';

import { Suspense } from 'react';
import CustomersPageInner from './page_inner';

export default function CustomersPage() {
  return (
    <Suspense fallback={<div>読み込み中…</div>}>
      <CustomersPageInner />
    </Suspense>
  );
}
