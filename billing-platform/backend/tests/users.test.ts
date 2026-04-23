import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { resetDb } from '../src/db/inMemoryDb';

const ADMIN_TOKEN = 'user-001';
const USER_TOKEN = 'user-002';

describe('Users API', () => {
  beforeEach(() => {
    resetDb();
  });

  // ─── PASSING ────────────────────────────────────────────────────────────────

  it('POST /users — creates a new user and returns 201', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'charlie@example.com', name: 'Charlie Diaz', password: 'hunter2' });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('charlie@example.com');
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.role).toBe('user');
  });

  it('POST /users — returns 409 when email is already registered', async () => {
    // alice@example.com is seeded in the DB
    const res = await request(app)
      .post('/users')
      .send({ email: 'alice@example.com', name: 'Alice Clone', password: 'password1' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });

  it('GET /users/:id — returns the correct user for a valid ID', async () => {
    const res = await request(app)
      .get('/users/user-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe('user-001');
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('GET /users/:id — returns 401 when no Authorization header is present', async () => {
    const res = await request(app).get('/users/user-001');
    expect(res.status).toBe(401);
  });

  // ─── FAILING ────────────────────────────────────────────────────────────────

  /**
   * EXPECTED FAILURE — BUG-1 (Security)
   *
   * The GET /users/:id response currently includes the passwordHash field.
   * This test asserts that credential-adjacent data must NOT be present in
   * any user-facing API response.
   *
   * Hint: trace the return value of userService.getUserById() through the
   * route handler. No transformation happens before res.json().
   */
  it('GET /users/:id — response must NOT expose passwordHash [EXPECTED FAIL]', async () => {
    const res = await request(app)
      .get('/users/user-002')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();

    // This assertion FAILS: passwordHash is present in the response body.
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});
