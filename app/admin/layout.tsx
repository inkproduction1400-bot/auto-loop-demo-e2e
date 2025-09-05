// app/admin/layout.tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Link href="/admin" className={styles.brandLink}>
            <span className={styles.brandMark}>●</span>
            <span className={styles.brandText}>Admin</span>
          </Link>
        </div>

        <nav className={styles.nav}>
          <Link href="/admin" className={styles.navItem}>ダッシュボード</Link>
          <Link href="/admin/reservations" className={styles.navItem}>予約一覧</Link>
          <Link href="/admin/customers" className={styles.navItem}>顧客一覧</Link>
        </nav>
      </aside>

      {/* Main area */}
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>管理画面</div>
          <div className={styles.headerActions} />
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
