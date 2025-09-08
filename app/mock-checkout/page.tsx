'use client';

import { useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MockCheckoutInner() {
  const sp = useSearchParams();
  const amount = useMemo(() => Number(sp.get('amount') ?? 1000), [sp]);
  const currency = (sp.get('currency') ?? 'jpy').toLowerCase();

  const [card, setCard] = useState('');
  const [mm, setMm] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const pay = () => {
    // 4242... → success、4000...0002 → decline
    const normalized = card.replace(/\s+/g, '');
    const isSuccess = normalized.startsWith('4242');
    const isDecline = normalized.endsWith('0002');
    const next =
      isDecline ? '/?status=cancel' : isSuccess ? '/?status=success' : '/?status=success';
    window.location.href = next;
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={{ marginTop: 0 }}>Mock Stripe Checkout</h1>
        <p>
          Amount: <b>{currency.toUpperCase()} {amount}</b>
        </p>
        <div style={styles.field}>
          <label>Card number</label>
          <input
            placeholder="Card number"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
        </div>
        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 1 }}>
            <label>MM / YY</label>
            <input
              placeholder="MM / YY"
              value={mm}
              onChange={(e) => setMm(e.target.value)}
            />
          </div>
          <div style={{ width: 12 }} />
          <div style={{ ...styles.field, flex: 1 }}>
            <label>CVC</label>
            <input
              placeholder="CVC"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
            />
          </div>
        </div>
        <div style={styles.field}>
          <label>Name on card</label>
          <input
            placeholder="Name on card"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div style={{ height: 12 }} />
        <button style={styles.payBtn} onClick={pay}>
          Pay
        </button>
      </div>
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<div>Loading checkout...</div>}>
      <MockCheckoutInner />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    background: '#f5f7fb',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
  },
  card: {
    width: 420,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,.06)',
  },
  field: { display: 'grid', gap: 6 },
  row: { display: 'flex' },
  payBtn: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
