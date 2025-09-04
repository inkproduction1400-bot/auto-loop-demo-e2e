export const testData = {
  tenants: {
    primary: {
      id: 'test-tenant-001',
      apiKey: 'sk_test_ADMIN_KEY_FOR_TESTING'
    },
    secondary: {
      id: 'test-tenant-002',
      apiKey: 'sk_test_ADMIN_KEY_FOR_TESTING_2'
    }
  },

  customers: {
    valid: {
      name: 'テスト太郎',
      email: 'test@example.com',
      phone: '+81901234567'
    },
    invalid: {
      email: 'invalid-email',
      phone: '123'
    }
  },

  cards: {
    success: '4242424242424242',
    decline: '4000000000000002',
    authRequired: '4000002500003155'
  },

  dates: {
    today: '2025-03-01',
    tomorrow: '2025-03-02',
    day7Later: '2025-03-08',
    day90Later: '2025-05-30',
    day91Later: '2025-05-31'
  }
};
