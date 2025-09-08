import ReservationWidget from '@/components/ReservationWidget'; // ← tsconfig の "@/*": ["./src/*"] と整合

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ padding: '40px 20px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>イベント予約システム</h1>
        <ReservationWidget />
      </div>
    </main>
  );
}
