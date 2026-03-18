import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query, execute } from '../src/db/helpers.js';
import { toIsoTime } from '../src/db/helpers.js';
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

describe('GET /auth/me', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('valid token returns current user', async () => {
    const email = `me-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: 'Test User',
      email: email.toLowerCase(),
      ndaAccepted: false,
      ndaAcceptedAt: null,
      ndaVersion: null,
      walkthroughSeen: false,
      walkthroughSeenAt: null,
    });
  });

  it('missing token returns 401', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Authentication'),
    });
  });

  it('invalid token returns 401', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token-12345');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Invalid'),
    });
  });

  it('expired token returns 401', async () => {
    const email = `expired-session-${Date.now()}@test.com`;
    const token = await getToken(email);

    const tokenHash = hashSessionToken(token);
    const past = new Date(Date.now() - 60000);
    execute(
      'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
      [toIsoTime(past), tokenHash]
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

  it('revoked token returns 401', async () => {
    const email = `revoked-${Date.now()}@test.com`;
    const token = await getToken(email);

    const tokenHash = hashSessionToken(token);
    const now = toIsoTime(new Date());
    execute(
      'UPDATE sessions SET revoked_at = ? WHERE token_hash = ?',
      [now, tokenHash]
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

  it('response includes correct NDA and walkthrough status', async () => {
    const email = `nda-walk-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'NDA', lastName: 'User', email, companyName: 'Test Co' });

    const now = toIsoTime(new Date());
    execute(
      'UPDATE users SET nda_accepted_at = ?, nda_version = ?, walkthrough_seen_at = ? WHERE email = ?',
      [now, '1.0', now, email.toLowerCase()]
    );

    const otp = getLastTestOtp();
    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });
    const token = verifyRes.body.token;

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ndaAccepted).toBe(true);
    expect(res.body.ndaAcceptedAt).toBeTruthy();
    expect(res.body.ndaVersion).toBe('1.0');
    expect(res.body.walkthroughSeen).toBe(true);
    expect(res.body.walkthroughSeenAt).toBeTruthy();
  });
});
