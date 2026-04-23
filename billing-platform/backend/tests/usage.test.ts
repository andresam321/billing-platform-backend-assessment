import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { resetDb } from '../src/db/inMemoryDb';

const ADMIN_TOKEN = 'user-001';
const USER_TOKEN = 'user-002';

describe('Usage API', () => {
  beforeEach(() => {
    resetDb();
  });

  // ─── PASSING ────────────────────────────────────────────────────────────────

  it('POST /usage/track — records a usage event and returns 201', async () => {
    const res = await request(app)
      .post('/usage/track')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ endpoint: '/api/search', cost: 1 });

    expect(res.status).toBe(201);
    expect(res.body.event).toBeDefined();
    expect(res.body.event.userId).toBe('user-002');
    expect(res.body.event.endpoint).toBe('/api/search');
    expect(res.body.event.id).toBeDefined();
  });

  it('GET /usage/:userId — returns 200 with a response body', async () => {
    // Track one event first
    await request(app)
      .post('/usage/track')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ endpoint: '/api/query' });

    const res = await request(app)
      .get('/usage/user-002')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
    // Response body exists and is an object (shape validated in the failing test below)
    expect(typeof res.body).toBe('object');
    expect(res.body).not.toBeNull();
  });

  // ─── FAILING ────────────────────────────────────────────────────────────────

  /**
   * EXPECTED FAILURE — BUG-5 (API contract mismatch) — MISLEADING
   *
   * The frontend UsagePanel reads `{ data, count }` from the GET /usage/:userId
   * response. The backend returns `{ events, total }`. Both `data` and `count`
   * resolve to undefined on the client, causing the panel to silently render
   * empty state with no visible error.
   *
   * Why misleading: the test failure message is "expected undefined to be
   * defined." A developer unfamiliar with the contract might assume the user
   * simply has no events, not that the field names don't match.
   * Check: console.log the full res.body and compare to what UsagePanel.tsx
   * actually destructures.
   */
  it('GET /usage/:userId — response shape should be { data: [...], count: number } [EXPECTED FAIL]', async () => {
    await request(app)
      .post('/usage/track')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ endpoint: '/api/ingest' });

    const res = await request(app)
      .get('/usage/user-002')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);

    // FAILS: res.body.data is undefined — the field is named `events`, not `data`
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  /**
   * EXPECTED FAILURE — BUG-3a (No deduplication / missing idempotency check)
   *
   * When a client submits the same usage event twice with the same idempotencyKey
   * (e.g., on network retry or accidental double-submit), only one event record
   * should be stored and currentUsage should only increment once.
   *
   * Why it fails: usageService.trackEvent accepts idempotencyKey but never checks
   * whether an event with that key already exists. Both requests succeed, two
   * events are written, and currentUsage increments twice.
   *
   * Real-world impact: users get billed for calls they only made once.
   */
  it('POST /usage/track — duplicate idempotencyKey should not create a second event [EXPECTED FAIL]', async () => {
    const payload = {
      endpoint: '/api/export',
      cost: 1,
      idempotencyKey: 'client-req-abc-9f3d',
    };

    const first = await request(app)
      .post('/usage/track')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send(payload);

    expect(first.status).toBe(201);

    // Second call with identical idempotencyKey — should be a no-op
    const second = await request(app)
      .post('/usage/track')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send(payload);

    expect(second.status).toBe(201);
    // Should return the original event, not a new one
    expect(second.body.event.id).toBe(first.body.event.id);

    // Verify only one event was recorded
    const historyRes = await request(app)
      .get('/usage/user-002')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    // Use the correct field name (events, not data) to isolate this assertion
    const events = historyRes.body.events as Array<{ id: string }>;

    // FAILS: events.length === 2, not 1
    expect(events).toHaveLength(1);
  });
});
