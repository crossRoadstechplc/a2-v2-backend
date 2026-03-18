import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query, execute } from '../src/db/helpers.js';
import { hashOtp } from '../src/services/otp/hash.js';
import { toIsoTime } from '../src/db/helpers.js';
import { SESSION_EXPIRY_HOURS } from '../src/services/session/repository.js';
import { hashSessionToken } from '../src/services/session/index.js';

describe('POST /auth/verify-otp', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('valid OTP creates session and returns token', async () => {
    const email = `verify-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Verify', lastName: 'User', email, companyName: 'Test Co' });

    const otp = getLastTestOtp();
    expect(otp).toBeDefined();

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      token: expect.any(String),
      user: expect.objectContaining({
        id: expect.any(Number),
        firstName: 'Verify',
        lastName: 'User',
        email: email.toLowerCase(),
      }),
      ndaAccepted: false,
      walkthroughSeen: false,
    });
    expect(res.body.token).toHaveLength(64);
    expect(res.body.token).toMatch(/^[a-f0-9]+$/);
  });

  it('invalid OTP returns 401', async () => {
    const email = `invalid-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Invalid', lastName: 'OTP User', email, companyName: 'Test Co' });

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Invalid'),
    });
  });

  it('expired OTP returns 401', async () => {
    const email = `expired-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Expired', lastName: 'User', email, companyName: 'Test Co' });

    const now = toIsoTime(new Date());
    execute(
      'UPDATE otp_codes SET used_at = ? WHERE email = ?',
      [now, email.toLowerCase()]
    );
    const past = new Date(Date.now() - 60000);
    const expiredHash = hashOtp('123456');
    execute(
      'INSERT INTO otp_codes (email, code_hash, expires_at) VALUES (?, ?, ?)',
      [email.toLowerCase(), expiredHash, toIsoTime(past)]
    );

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp: '123456' });

    expect(res.status).toBe(401);
  });

  it('reused OTP returns 401', async () => {
    const email = `reused-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Reused', lastName: 'User', email, companyName: 'Test Co' });

    const otp = getLastTestOtp();

    const first = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });
    expect(second.status).toBe(401);
  });

  it('session row is created in DB', async () => {
    const email = `session-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Session', lastName: 'User', email, companyName: 'Test Co' });

    const otp = getLastTestOtp();
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });

    const token = res.body.token;
    const tokenHash = hashSessionToken(token);
    const sessions = query('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions[0].token_hash).not.toBe(token);
  });

  it('returned user summary includes nda and walkthrough flags', async () => {
    const email = `flags-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Flags', lastName: 'User', email, companyName: 'Test Co' });

    const otp = getLastTestOtp();
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });

    expect(res.body).toHaveProperty('ndaAccepted');
    expect(res.body).toHaveProperty('walkthroughSeen');
    expect(typeof res.body.ndaAccepted).toBe('boolean');
    expect(typeof res.body.walkthroughSeen).toBe('boolean');
    expect(res.body.ndaAccepted).toBe(false);
    expect(res.body.walkthroughSeen).toBe(false);
  });

  it('ndaAccepted and walkthroughSeen true when user has completed them', async () => {
    const email = `done-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Done', lastName: 'User', email, companyName: 'Test Co' });

    const now = toIsoTime(new Date());
    execute(
      'UPDATE users SET nda_accepted_at = ?, walkthrough_seen_at = ? WHERE email = ?',
      [now, now, email.toLowerCase()]
    );

    const otp = getLastTestOtp();
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });

    expect(res.body.ndaAccepted).toBe(true);
    expect(res.body.walkthroughSeen).toBe(true);
  });

  it('invalid email returns 400', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'not-email', otp: '123456' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('invalid OTP format returns 400', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'test@example.com', otp: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('token expiry is approximately 4 hours', async () => {
    const email = `expiry-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Expiry', lastName: 'User', email, companyName: 'Test Co' });

    const otp = getLastTestOtp();
    const before = Date.now();
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });
    const after = Date.now();

    const tokenHash = hashSessionToken(res.body.token);
    const session = query('SELECT expires_at FROM sessions WHERE token_hash = ?', [tokenHash])[0];
    const expiresAt = new Date(session.expires_at).getTime();

    const expectedMin = before + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000) - 5000;
    const expectedMax = after + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000) + 5000;

    expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt).toBeLessThanOrEqual(expectedMax);
  });
});
