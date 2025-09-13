// app/admin/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/lib/prisma';

/* --------- 日付ユーティリティ --------- */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const x = new Date(s);
  x.setDate(s.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}
const fmtJPY = (n: number) => `¥${(n ?? 0).toLocaleString('ja-JP')}`;
const fmtDT = (iso: string | Date) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
};

/* --------- サマリ取得（今日/今週, ステータス別含む） --------- */
async function getSummary() {
  const todayFrom = startOfDay();
  const todayTo = endOfDay();

  const weekFrom = startOfWeek();
  const weekTo = endOfWeek();

  const [todayPaid, weekPaid, todayAll, weekAll] = await Promise.all([
    prisma.reservation.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: 'PAID', createdAt: { gte: todayFrom, lte: todayTo } },
    }),
    prisma.reservation.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: 'PAID', createdAt: { gte: weekFrom, lte: weekTo } },
    }),
    prisma.reservation.groupBy({
      by: ['status'],
      where: { createdAt: { gte: todayFrom, lte: todayTo } },
      _count: { _all: true },
    }),
    prisma.reservation.groupBy({
      by: ['status'],
      where: { createdAt: { gte: weekFrom, lte: weekTo } },
      _count: { _all: true },
    }),
  ]);

  const toMap = (rows: { status: string; _count: { _all: number } }[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = r._count._all;
      return acc;
    }, {});

  return {
    today: {
      paidCount: todayPaid._count,
      paidAmount: todayPaid._sum.amount ?? 0,
      byStatus: toMap(todayAll),
    },
    week: {
      paidCount: weekPaid._count,
      paidAmount: weekPaid._sum.amount ?? 0,
      byStatus: toMap(weekAll),
    },
  };
}

/* --------- 直近30日の売上推移（PAID合計/日） --------- */
type SeriesPoint = { date: string; amount: number }; // date: 'YYYY-MM-DD'
async function getRevenueSeries(): Promise<SeriesPoint[]> {
  const today = startOfDay();
  const from = new Date(today);
  from.setDate(today.getDate() - 29); // 30日分

  // 期間内のPAIDを取得して日付キーで集計（SQLite対応のためJS側で集計）
  const rows = await prisma.reservation.findMany({
    where: { status: 'PAID', createdAt: { gte: from, lte: endOfDay(today) } },
    select: { amount: true, createdAt: true },
  });

  // バケット初期化（ゼロ埋め）
  const buckets = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
  }

  for (const r of rows) {
    const key = new Date(r.createdAt).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (r.amount ?? 0));
  }

  return Array.from(buckets.entries()).map(([date, amount]) => ({ date, amount }));
}

/* --------- 最新予約（直近10件） --------- */
type LatestRow = {
  id: string;
  createdAt: Date;
  date: Date;
  slot: string | null;
  amount: number;
  status: string;
  customer?: { name: string | null; email: string | null } | null;
};
async function getLatestReservations(limit = 10): Promise<LatestRow[]> {
  return prisma.reservation.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      date: true,
      slot: true,
      amount: true,
      status: true,
      customer: { select: { name: true, email: true } },
    },
  });
}

/* --------- 横長SVGラインチャート（クライアント不要） --------- */
function RevenueChartSVG({ series }: { series: SeriesPoint[] }) {
  const width = 1200;
  const height = 260;
  const padL = 48;
  const padR = 16;
  const padT = 18;
  const padB = 36;

  const xs = (i: number) =>
    padL + ((width - padL - padR) * i) / Math.max(1, series.length - 1);

  const maxY = Math.max(1, ...series.map((s) => s.amount));
  const ys = (v: number) =>
    height - padB - ((height - padT - padB) * v) / maxY;

  const points = series.map((s, i) => `${xs(i)},${ys(s.amount)}`).join(' ');

  // 目盛り（Y方向 4本）
  const gridLines = Array.from({ length: 5 }).map((_, i) => {
    const v = (maxY * i) / 4;
    const y = ys(v);
    return { y, v };
  });

  // Xラベル（5分割）
  const xTicks = 5;
  const xLabels = Array.from({ length: xTicks }).map((_, i) => {
    const idx = Math.round((series.length - 1) * (i / (xTicks - 1)));
    const s = series[idx];
    const label = s.date.slice(5).replace('-', '/'); // MM/DD
    return { x: xs(idx), label };
  });

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 260, display: 'block' }}
        aria-label="売上推移（直近30日）"
      >
        {/* 背景 */}
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        {/* グリッド */}
        {gridLines.map(({ y }, i) => (
          <line
            key={i}
            x1={padL}
            x2={width - padR}
            y1={y}
            y2={y}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        {/* 折れ線 */}
        <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" points={points} />
        {/* 範囲塗り（線の下） */}
        <polyline
          fill="rgba(37, 99, 235, 0.12)"
          stroke="none"
          points={[
            `${padL},${height - padB}`,
            points,
            `${width - padR},${height - padB}`,
          ].join(' ')}
        />

        {/* Y軸ラベル */}
        {gridLines.map(({ y, v }, i) => (
          <text
            key={i}
            x={padL - 8}
            y={y}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="11"
            fill="#64748b"
          >
            {fmtJPY(Math.round(v))}
          </text>
        ))}

        {/* X軸ラベル */}
        {xLabels.map(({ x, label }, i) => (
          <text
            key={i}
            x={x}
            y={height - 10}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            fontSize="11"
            fill="#64748b"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* --------- ダッシュボード（Server Component） --------- */
export default async function AdminTopPage() {
  const [s, series, latest] = await Promise.all([
    getSummary(),
    getRevenueSeries(),
    getLatestReservations(10),
  ]);

  const Card = ({
    title,
    children,
    style,
  }: {
    title: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <div style={{ ...styles.card, ...(style ?? {}) }}>
      <div style={styles.cardTtl}>{title}</div>
      <div>{children}</div>
    </div>
  );

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div style={styles.stat}>
      <div style={styles.statK}>{label}</div>
      <div style={styles.statV}>{value}</div>
    </div>
  );

  // キャンセル数（今日/今週）
  const cancelledToday = s.today.byStatus['CANCELLED'] ?? 0;
  const cancelledWeek = s.week.byStatus['CANCELLED'] ?? 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 追加：CSVエクスポートボタンバー */}
      <div style={styles.exportBar} aria-label="エクスポート操作">
        <a
          href="/api/admin/export/reservations.csv?limit=2000"
          target="_blank"
          rel="noopener"
          style={styles.exportBtn}
        >
          予約一覧をCSVで保存
        </a>
        <a
          href="/api/admin/export/customers.csv?limit=5000"
          target="_blank"
          rel="noopener"
          style={styles.exportBtn}
        >
          顧客一覧をCSVで保存
        </a>
      </div>

      {/* 上段4カード（売上×2 + ステータス×2） */}
      <div style={styles.grid}>
        <Card title="本日の売上（確定）">
          <Stat label="件数" value={`${s.today.paidCount} 件`} />
          <Stat label="金額" value={fmtJPY(s.today.paidAmount)} />
        </Card>

        <Card title="今週の売上（確定）">
          <Stat label="件数" value={`${s.week.paidCount} 件`} />
          <Stat label="金額" value={fmtJPY(s.week.paidAmount)} />
        </Card>

        <Card title="本日のステータス別">
          <ul style={styles.list}>
            {Object.entries(s.today.byStatus).map(([k, v]) => (
              <li key={k}>
                <b>{k}</b>: {v} 件
              </li>
            ))}
          </ul>
        </Card>

        {/* 追加：キャンセル数（今日/今週） */}
        <Card title="キャンセル数">
          <Stat label="本日" value={`${cancelledToday} 件`} />
          <div style={{ height: 6 }} />
          <Stat label="今週" value={`${cancelledWeek} 件`} />
        </Card>
      </div>

      {/* 下段：横長グラフ（直近30日の売上推移） */}
      <div>
        <div style={{ fontWeight: 900, margin: '6px 0 10px' }}>売上推移（直近30日）</div>
        <div style={styles.chartCard}>
          <RevenueChartSVG series={series} />
        </div>
      </div>

      {/* 追加：最新予約一覧（直近10件） */}
      <div>
        <div style={{ fontWeight: 900, margin: '6px 0 10px' }}>最新予約（直近10件）</div>
        <div style={styles.tableCard}>
          <table style={styles.table} aria-label="最新予約一覧">
            <thead style={styles.thead}>
              <tr>
                <th style={{...styles.th, width: 160}}>作成</th>
                <th style={{...styles.th, width: 160}}>日付</th>
                <th style={{...styles.th, width: 80}}>枠</th>
                <th style={{...styles.th, width: 90}}>金額</th>
                <th style={{...styles.th, width: 110}}>状態</th>
                <th style={styles.th}>顧客</th>
                <th style={{...styles.th, width: 80}}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {latest.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.empty}>データがありません</td>
                </tr>
              ) : latest.map((r) => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>{fmtDT(r.createdAt)}</td>
                  <td style={styles.td}>{fmtDT(r.date)}</td>
                  <td style={styles.td}>{r.slot ?? '-'}</td>
                  <td style={styles.td}>{fmtJPY(r.amount)}</td>
                  <td style={styles.td}>{r.status}</td>
                  <td style={styles.td}>
                    {(r.customer?.name ?? '-')}{' '}
                    <span style={{ color: '#64748b' }}>（{r.customer?.email ?? '-'}）</span>
                  </td>
                  <td style={styles.td}>
                    <a href={`/reservations/${r.id}`} style={styles.detailBtn}>詳細</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* --------- styles --------- */
const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  cardTtl: {
    fontWeight: 800,
    marginBottom: 8,
  },
  stat: {
    display: 'grid',
    gap: 4,
  },
  statK: {
    color: '#64748b',
    fontSize: 12,
  },
  statV: {
    fontWeight: 900,
    fontSize: 20,
  },
  list: {
    margin: 0,
    paddingLeft: 18,
  },
  chartCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 8,
  },
  /* 追加：最新予約テーブル */
  tableCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  thead: {
    background: '#f8fafc',
    color: '#475569',
    fontSize: 13,
  },
  th: {
    textAlign: 'left' as const,
    padding: '10px 14px',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap' as const,
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '10px 14px',
    fontSize: 13,
    verticalAlign: 'top' as const,
    whiteSpace: 'nowrap' as const,
  },
  empty: {
    padding: '14px',
    textAlign: 'center' as const,
    color: '#64748b',
  },
  detailBtn: {
    display: 'inline-block',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: 12,
    textDecoration: 'none',
    color: '#0f172a',
  },
  /* 追加：CSVエクスポートボタンバー */
  exportBar: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  exportBtn: {
    display: 'inline-block',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    textDecoration: 'none',
    color: '#0f172a',
    background: '#ffffff',
  },
};
