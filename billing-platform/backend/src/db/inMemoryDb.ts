import { User, Subscription, UsageEvent } from '../types';

interface Database {
  users: User[];
  subscriptions: Subscription[];
  usageEvents: UsageEvent[];
}

function buildSeedData(): Database {
  return {
    users: [
      {
        id: 'user-001',
        email: 'alice@example.com',
        name: 'Alice Chen',
        // Stored as base64(password + salt) — simplified for demo
        passwordHash: 'YWxpY2VwYXNzd29yZHNhbHRfa2V5X3Yx',
        role: 'admin',
        createdAt: '2024-01-15T08:00:00.000Z',
      },
      {
        id: 'user-002',
        email: 'bob@example.com',
        name: 'Bob Martinez',
        passwordHash: 'Ym9icGFzc3dvcmRzYWx0X2tleV92MQ==',
        role: 'user',
        createdAt: '2024-02-20T10:30:00.000Z',
      },
    ],
    subscriptions: [
      {
        id: 'sub-001',
        userId: 'user-001',
        plan: 'pro',
        status: 'active',
        monthlyLimit: 1000,
        currentUsage: 0,
        billingCycleStart: '2024-11-01T00:00:00.000Z',
        updatedAt: '2024-11-01T00:00:00.000Z',
      },
      {
        id: 'sub-002',
        userId: 'user-002',
        plan: 'free',
        status: 'active',
        monthlyLimit: 100,
        currentUsage: 0,
        billingCycleStart: '2024-11-01T00:00:00.000Z',
        updatedAt: '2024-11-01T00:00:00.000Z',
      },
    ],
    usageEvents: [],
  };
}

export const db: Database = buildSeedData();

/**
 * Resets the database to its initial seed state.
 * Called in beforeEach hooks during testing.
 */
export function resetDb(): void {
  const seed = buildSeedData();
  db.users = seed.users;
  db.subscriptions = seed.subscriptions;
  db.usageEvents = seed.usageEvents;
}
