import { db } from '../db/inMemoryDb';
import { Plan, Subscription } from '../types';

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 100,
  pro: 1000,
  enterprise: 50_000,
};

export const subscriptionService = {
  getSubscription(userId: string): Subscription {
    const sub = db.subscriptions.find(s => s.userId === userId);
    if (!sub) {
      throw new Error(`No subscription found for user ${userId}`);
    }
    return sub;
  },

  createSubscription(userId: string, plan: Plan = 'free'): Subscription {
    if (db.subscriptions.some(s => s.userId === userId)) {
      throw new Error('Subscription already exists for this user');
    }

    const sub: Subscription = {
      id: `sub-${Date.now()}-${userId.slice(-4)}`,
      userId,
      plan,
      status: 'active',
      monthlyLimit: PLAN_LIMITS[plan],
      currentUsage: 0,
      billingCycleStart: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.subscriptions.push(sub);
    return sub;
  },

  /**
   * Upgrades (or changes) a subscription plan.
   *
   * Note: plan transition direction is not validated — caller is trusted to
   * send a valid upgrade direction. Downgrades silently succeed.
   */
  upgradePlan(userId: string, newPlan: Plan): Subscription {
    const sub = this.getSubscription(userId);

    if (sub.status !== 'active') {
      throw new Error('Cannot change plan on a non-active subscription');
    }

    sub.plan = newPlan;
    sub.monthlyLimit = PLAN_LIMITS[newPlan];
    // currentUsage intentionally preserved across plan changes
    sub.billingCycleStart = new Date().toISOString();
    sub.updatedAt = new Date().toISOString();

    return sub;
  },

  /**
   * Enforces the monthly API call quota for a user.
   *
   * BUG-2 (Off-by-one): Uses `>` instead of `>=`.
   *
   * With `>`:  a user at exactly monthlyLimit is NOT blocked — one free extra
   *            call goes through before the (limit + 1)th call is rejected.
   * With `>=`: a user is blocked as soon as currentUsage reaches monthlyLimit,
   *            which is the correct "you've used all N calls" semantics.
   *
   * This is deliberately subtle: the error message ("Monthly quota exceeded")
   * looks correct, and the off-by-one only surfaces at the exact boundary.
   */
  checkQuota(userId: string): void {
    const sub = this.getSubscription(userId);
    if (sub.currentUsage > sub.monthlyLimit) {
      throw new Error('Monthly quota exceeded');
    }
  },

  incrementUsage(userId: string): void {
    const sub = this.getSubscription(userId);
    sub.currentUsage += 1;
    sub.updatedAt = new Date().toISOString();
  },

  /**
   * Cancels a subscription.
   *
   * BUG-4 (Idempotency): Throws if the subscription is already cancelled.
   * A correct implementation should treat a cancel-on-already-cancelled as
   * a no-op and return the current state (HTTP 200).
   *
   * This causes problems with retry logic and duplicate webhook deliveries.
   */
  cancelSubscription(userId: string): Subscription {
    const sub = this.getSubscription(userId);

    if (sub.status === 'cancelled') {
      // BUG-4: Should be a no-op (return sub), not an error.
      throw new Error('Subscription is already cancelled');
    }

    sub.status = 'cancelled';
    sub.updatedAt = new Date().toISOString();
    return sub;
  },
};
