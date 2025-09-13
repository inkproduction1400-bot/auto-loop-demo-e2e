// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import ReservationWidget from '@/components/ReservationWidget';
import { trackUI } from '@/lib/obs/ui';

export default function Home() {
  const [msg, setMsg] = useState<string | null>(null);

  // ページロード時に記録
  useEffect(() => {
    trackUI('home_opened');
  }, []);

  // checkout の戻りステータスを拾って表示＆計測
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const status = (url.searchParams.get('status') || '').toLowerCase();
      const rid = url.searchParams.get('reservationId') ?? null;

      if (status === 'success') {
        setMsg('決済が完了しましたで御座る');
        trackUI('checkout_result_on_home', { status: 'success', reservationId: rid });

        // ★ ReservationId があればサーバーに Confirm API を叩く
        if (rid) {
          fetch(`/api/reservations/${rid}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
            .then((r) => r.json())
            .then((data) => {
              trackUI('reservation_confirm_api_result', {
                ok: data?.ok,
                reservationId: rid,
              });
            })
            .catch((err) => {
              trackUI('reservation_confirm_api_error', { error: String(err), reservationId: rid });
            });
        }

        // 表示後にクエリを消してリロード時の二重表示を防ぐ
        url.searchParams.delete('status');
        url.searchParams.delete('reservationId');
        window.history.replaceState({}, '', url.toString());
      } else if (status === 'cancel') {
        setMsg('決済がキャンセルされましたで御座る');
        trackUI('checkout_result_on_home', { status: 'cancel', reservationId: rid });
        url.searchParams.delete('status');
        url.searchParams.delete('reservationId');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // noop
    }
  }, []);

  const onStartBooking = () => {
    trackUI('booking_start_clicked');
    // ここで予約ウィジェット内の処理や遷移を呼び出してもOKで御座る
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ padding: '40px 20px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>
          イベント予約システム
        </h1>

        {/* 決済結果の簡易バナー表示 */}
        {msg && (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: '0 auto 24px',
              maxWidth: 720,
              border: '1px solid #d1fae5',
              background: '#ecfdf5',
              color: '#065f46',
              borderRadius: 8,
              padding: '12px 14px',
            }}
          >
            {msg}
          </div>
        )}

        {/* 予約ウィジェットに直接クリックトラッキングを渡す例 */}
        <div onClick={onStartBooking}>
          <ReservationWidget />
        </div>
      </div>
    </main>
  );
}
