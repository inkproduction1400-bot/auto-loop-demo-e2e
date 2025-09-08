// tests/e2e/fixtures/testData.ts

// ===== 日付ユーティリティ（タイムゾーンずれ防止のため正午固定） =====
const startOfToday = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0); // 正午に固定して日付ずれ防止
  return d;
};
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return fmt(d);
};

// ===== 相対日付で dates を構築 =====
const base = startOfToday();

export const testData = {
  tenants: {
    primary: {
      id: 'test-tenant-001',
      apiKey: 'sk_test_ADMIN_KEY_FOR_TESTING',
    },
    secondary: {
      id: 'test-tenant-002',
      apiKey: 'sk_test_ADMIN_KEY_FOR_TESTING_2',
    },
  },

  customers: {
    valid: {
      name: 'テスト太郎',
      email: 'test@example.com',
      phone: '+81901234567',
    },
    invalid: {
      email: 'invalid-email',
      phone: '123',
    },
  },

  cards: {
    success: '4242424242424242',
    decline: '4000000000000002',
    authRequired: '4000002500003155',
  },

  // 相対日付
  dates: {
    today: fmt(base),
    tomorrow: plus(base, 1),
    day7Later: plus(base, 7),
    day90Later: plus(base, 90),
    day91Later: plus(base, 91),
  },
};

// ===== カレンダーの予約可能スロット（90日以内を必ず用意） =====
const makeSlots = () => ['10:00–10:30', '14:00–14:30', '16:00–16:30'];

export const availableTimeSlots: Record<string, string[]> = {
  [plus(base, 1)]: makeSlots(),
  [plus(base, 2)]: makeSlots(),
  [plus(base, 90)]: makeSlots(),
};
