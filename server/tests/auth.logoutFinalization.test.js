import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query, execute } from '../src/db/helpers.js';
import { hashSessionToken } from '../src/services/session/index.js';
import { toIsoTime } from '../src/db/helpers.js';

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

describe('Logout and session finalization', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('logout finalizes access log', async () => {
    const email = `finalize-${Date.now()}@test.com`;
    const token = await getToken(email);
    const tokenHash = hashSessionToken(token);
    const session = query('SELECT id FROM sessions WHERE token_hash = ?', [tokenHash])[0];

    let log = query('SELECT * FROM access_logs WHERE session_id = ?', [session.id])[0];
    expect(log.status).toBe('active');
    expect(log.logout_at).toBeNull();
    expect(log.session_seconds).toBeNull();

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    log = query('SELECT * FROM access_logs WHERE session_id = ?', [session.id])[0];
    expect(log.status).toBe('logged_out');
    expect(log.logout_at).toBeDefined();
    expect(log.session_seconds).toBeDefined();
    expect(typeof log.session_seconds).toBe('number');
    expect(log.session_seconds).toBeGreaterThanOrEqual(0);
  });

  it('logout accumulates total_session_seconds', async () => {
    const email = `accumulate-${Date.now()}@test.com`;
    const token = await getToken(email);

    const userBefore = query('SELECT total_session_seconds FROM users WHERE email = ?', [email.toLowerCase()])[0];
    const totalBefore = userBefore?.total_session_seconds ?? 0;

    await new Promise((r) => setTimeout(r, 100));

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    const tokenHash = hashSessionToken(token);
    const session = query('SELECT id FROM sessions WHERE token_hash = ?', [tokenHash])[0];
    const log = query('SELECT session_seconds FROM access_logs WHERE session_id = ? AND status = ?', [session.id, 'logged_out'])[0];

    const userAfter = query('SELECT total_session_seconds FROM users WHERE email = ?', [email.toLowerCase()])[0];
    expect(userAfter.total_session_seconds).toBe(totalBefore + log.session_seconds);
  });

  it('repeated logout/finalization does not double count', async () => {
    const email = `nodouble-${Date.now()}@test.com`;
    const token = await getToken(email);

    const firstRes = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(firstRes.status).toBe(200);

    const userAfterFirst = query('SELECT total_session_seconds FROM users WHERE email = ?', [email.toLowerCase()])[0];
    const totalAfterFirst = userAfterFirst.total_session_seconds;

    const secondRes = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(secondRes.status).toBe(401);

    const userAfterSecond = query('SELECT total_session_seconds FROM users WHERE email = ?', [email.toLowerCase()])[0];
    expect(userAfterSecond.total_session_seconds).toBe(totalAfterFirst);
  });
});

describe('Expired session finalization', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('expired session finalization works', async () => {
    const email = `expired-finalize-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Expired', lastName: 'User', email, companyName: 'Test Co' });

    const otp = getLastTestOtp();
    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });
    const token = verifyRes.body.token;
    const tokenHash = hashSessionToken(token);
    const session = query('SELECT id FROM sessions WHERE token_hash = ?', [tokenHash])[0];

    execute(
      'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
      [toIsoTime(new Date(Date.now() - 60000)), tokenHash]
    );

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(401);

    const log = query('SELECT * FROM access_logs WHERE session_id = ?', [session.id])[0];
    expect(log.status).toBe('expired');
    expect(log.logout_at).toBeDefined();
    expect(log.session_seconds).toBeDefined();
  });

  it('expired session cannot access protected routes', async () => {
    const email = `expired-block-${Date.now()}@test.com`;
    const token = await getToken(email);
    const tokenHash = hashSessionToken(token);

    execute(
      'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
      [toIsoTime(new Date(Date.now() - 60000)), tokenHash]
    );

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Invalid'),
    });
  });

  it('expired session accumulates total_session_seconds', async () => {
    const email = `expired-accumulate-${Date.now()}@test.com`;
    const token = await getToken(email);
    const tokenHash = hashSessionToken(token);
    const session = query('SELECT id FROM sessions WHERE token_hash = ?', [tokenHash])[0];
    expect(session).toBeDefined();

    await new Promise((r) => setTimeout(r, 1100));
    await request(app)
      .post('/auth/heartbeat')
      .set('Authorization', `Bearer ${token}`);

    execute(
      'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
      [toIsoTime(new Date(Date.now() - 60000)), tokenHash]
    );

    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    const log = query('SELECT session_seconds FROM access_logs WHERE session_id = ? AND status = ?', [session.id, 'expired'])[0];
    expect(log).toBeDefined();
    expect(log.session_seconds).toBeGreaterThanOrEqual(1);

    const user = query('SELECT total_session_seconds FROM users WHERE email = ?', [email.toLowerCase()])[0];
    expect(user.total_session_seconds).toBe(log.session_seconds);
  });
});
