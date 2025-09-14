// app/dev/email-preview/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { redirect } from 'next/navigation';
import EmailPreviewClient from './Client';

const DISABLED = process.env.NEXT_PUBLIC_DISABLE_DEV_ROUTES === '1';

export default function Page() {
  if (DISABLED) {
    // CI / 本番では開発用ページを出さない
    redirect('/');
  }
  return <EmailPreviewClient />;
}
