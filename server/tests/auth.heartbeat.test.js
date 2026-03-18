import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query } from '../src/db/helpers.js';
import { hashSessionToken } from '../src/services/session/index.js';

function getToken(email) {
  return request(app)
    .post('/auth/request-otp')
    .send({ firstName: 'Test', lastName: 'User', email, companyName: 'Test Co' })
    .then(() => getLastTestOtp())
    .then((otp) =>
      request(app)
        .post('/auth/verify-otp')
        .send({ email, otp })
    )
    .then((res) => res.body.token);
}

describe('POST /auth/heartbeat', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('authenticated heartbeat returns success', async () => {
    const email = `heartbeat-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .post('/auth/heartbeat')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('unauthenticated heartbeat returns 401', async () => {
    const res = await request(app).post('/auth/heartbeat');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Authentication'),
    });
  });

  it('heartbeat updates sessions.last_activity_at', async () => {
    const email = `session-activity-${Date.now()}@test.com`;
    const token = await getToken(email);
    const tokenHash = hashSessionToken(token);

    const before = query('SELECT last_activity_at FROM sessions WHERE token_hash = ?', [tokenHash])[0];
    expect(before.last_activity_at).toBeDefined();

    await new Promise((r) => setTimeout(r, 50));

    await request(app)
      .post('/auth/heartbeat')
      .set('Authorization', `Bearer ${token}`);

    const after = query('SELECT last_activity_at FROM sessions WHERE token_hash = ?', [tokenHash])[0];
    expect(new Date(after.last_activity_at).getTime()).toBeGreaterThan(
      new Date(before.last_activity_at).getTime()
    );
  });

  it('heartbeat updates access_logs.last_activity_at', async () => {
    const email = `accesslog-activity-${Date.now()}@test.com`;
    const token = await getToken(email);
    const tokenHash = hashSessionToken(token);
    const session = query('SELECT id FROM sessions WHERE token_hash = ?', [tokenHash])[0];

    const before = query(
      'SELECT last_activity_at FROM access_logs WHERE session_id = ? AND status = ?',
      [session.id, 'active']
    )[0];
    expect(before.last_activity_at).toBeDefined();

    await new Promise((r) => setTimeout(r, 50));

    await request(app)
      .post('/auth/heartbeat')
      .set('Authorization', `Bearer ${token}`);

    const after = query(
      'SELECT last_activity_at FROM access_logs WHERE session_id = ? AND status = ?',
      [session.id, 'active']
    )[0];
    expect(new Date(after.last_activity_at).getTime()).toBeGreaterThan(
      new Date(before.last_activity_at).getTime()
    );
  });

  it('heartbeat updates users.last_seen_at', async () => {
    const email = `userseen-${Date.now()}@test.com`;
    const token = await getToken(email);
    const user = query('SELECT id, last_seen_at FROM users WHERE email = ?', [email.toLowerCase()])[0];

    const beforeSeen = user.last_seen_at;
    expect(beforeSeen).toBeDefined();

    await new Promise((r) => setTimeout(r, 50));

    await request(app)
      .post('/auth/heartbeat')
      .set('Authorization', `Bearer ${token}`);

    const after = query('SELECT last_seen_at FROM users WHERE id = ?', [user.id])[0];
    expect(new Date(after.last_seen_at).getTime()).toBeGreaterThan(
      new Date(beforeSeen).getTime()
    );
  });
});
