import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db, resetDb } from '../src/db/inMemoryDb';

const ADMIN_TOKEN = 'user-001';
const USER_TOKEN = 'user-002';

describe('Subscriptions API', () => {
  beforeEach(() => {
    resetDb();
  });

  // ─── PASSING ────────────────────────────────────────────────────────────────

  it('GET /subscriptions/:userId — returns the subscription for the authenticated user', async () => {
    const res = await request(app)
      .get('/subscriptions/user-002')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeDefined();
    expect(res.body.subscription.userId).toBe('user-002');
    expect(res.body.subscription.plan).toBe('free');
    expect(res.body.subscription.monthlyLimit).toBe(100);
    expect(res.body.subscription.status).toBe('active');
  });

  it('POST /subscriptions/upgrade — changes the plan and updates monthlyLimit', async () => {
    const res = await request(app)
      .post('/subscriptions/upgrade')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ userId: 'user-002', plan: 'pro' });

    expect(res.status).toBe(200);
    expect(res.body.subscription.plan).toBe('pro');
    expect(res.body.subscription.monthlyLimit).toBe(1000);
  });

  // ─── FAILING ────────────────────────────────────────────────────────────────

  /**
   * EXPECTED FAILURE — BUG-2 (Off-by-one quota enforcement) — MISLEADING
   *
   * This test sets currentUsage to exactly monthlyLimit and asserts that
   * the NEXT call is rejected with 429.
   *
   * Why it fails: checkQuota uses `>` instead of `>=`. When currentUsage
   * equals monthlyLimit, the condition `currentUsage > monthlyLimit` is false,
   * so the call is allowed through. The 429 is only returned after one
   * additional call (at currentUsage = limit + 1).
   *
   * The misleading aspect: the error message ("Monthly quota exceeded") looks
   * correct when it eventually fires. A developer might initially question
   * whether the test expectation is off-by-one rather than the implementation.
   * Compare the service condition carefully against the business requirement:
   * "monthlyLimit means the user may make exactly that many calls."
   */
  it('Usage at exactly monthlyLimit should be rejected (quota boundary) [EXPECTED FAIL]', async () => {
    // Directly set usage to the limit to avoid 100 HTTP round-trips
    const sub = db.subscriptions.find(s => s.userId === 'user-002')!;
    sub.currentUsage = sub.monthlyLimit; // 100 / 100

    // With correct `>=`: 100 >= 100 → true → 429 ✓
    // With BUG `>`:      100 > 100  → false → 201 ✗  (this is what currently happens)
    const res = await request(app)
      .post('/usage/track')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ endpoint: '/api/data' });

    // FAILS: the response is 201, not 429
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('QUOTA_EXCEEDED');
  });

  /**
   * EXPECTED FAILURE — BUG-4 (Non-idempotent cancellation)
   *
   * Cancelling an already-cancelled subscription should be a no-op (200).
   * Many callers — retry logic, webhooks, admin tooling — may cancel the same
   * subscription more than once. A correct implementation returns the current
   * state without erroring.
   *
   * Why it fails: cancelSubscription throws 'Subscription is already cancelled'
   * when status is already 'cancelled', which the route handler converts to 400.
   */
  it('POST /subscriptions/:userId/cancel — should be idempotent [EXPECTED FAIL]', async () => {
    // First cancellation — should succeed
    const first = await request(app)
      .post('/subscriptions/user-001/cancel')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(first.status).toBe(200);
    expect(first.body.subscription.status).toBe('cancelled');

    // Second cancellation — should also succeed (no-op, not an error)
    const second = await request(app)
      .post('/subscriptions/user-001/cancel')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    // FAILS: returns 400 with "Subscription is already cancelled"
    expect(second.status).toBe(200);
    expect(second.body.subscription.status).toBe('cancelled');
  });
});
