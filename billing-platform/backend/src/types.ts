export type Plan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  monthlyLimit: number;
  currentUsage: number;
  billingCycleStart: string;
  updatedAt: string;
}

export interface UsageEvent {
  id: string;
  userId: string;
  endpoint: string;
  cost: number;
  idempotencyKey?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}
