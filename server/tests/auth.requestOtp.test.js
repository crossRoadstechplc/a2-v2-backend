import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query } from '../src/db/helpers.js';

describe('POST /auth/request-otp', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('valid request returns success', async () => {
    const res = await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Alice', lastName: 'User', email: 'alice@example.com', companyName: 'Test Co' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: expect.any(String),
    });
    expect(res.body.message).toContain('verification code');
  });

  it('invalid email returns 400', async () => {
    const res = await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Bob', lastName: 'User', email: 'not-an-email', companyName: 'Test Co' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/invalid|email/i);
  });

  it('missing firstName returns 400', async () => {
    const res = await request(app)
      .post('/auth/request-otp')
      .send({ lastName: 'User', email: 'bob@example.com', companyName: 'Test Co' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/first|name|required/i);
  });

  it('user is created on first request', async () => {
    const email = `first-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'First', lastName: 'User', email, companyName: 'Test Co' });

    const users = query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    expect(users).toHaveLength(1);
    expect(users[0].first_name).toBe('First');
    expect(users[0].last_name).toBe('User');
    expect(users[0].name).toBe('First User');
  });

  it('repeated request does not create duplicate user', async () => {
    const email = `repeat-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Repeat', lastName: 'User', email, companyName: 'Test Co' });
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Repeat', lastName: 'User Updated', email, companyName: 'Test Co' });

    const users = query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    expect(users).toHaveLength(1);
    expect(users[0].first_name).toBe('Repeat');
    expect(users[0].last_name).toBe('User Updated');
  });

  it('OTP row is created', async () => {
    const email = `otp-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'OTP', lastName: 'User', email, companyName: 'Test Co' });

    const otpRows = query('SELECT * FROM otp_codes WHERE email = ?', [email.toLowerCase()]);
    expect(otpRows).toHaveLength(1);
    expect(otpRows[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(otpRows[0].code_hash).not.toBe(getLastTestOtp());
  });

  it('response does not expose raw OTP in normal mode', async () => {
    const res = await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'No', lastName: 'OTP Leak', email: `no-leak-${Date.now()}@test.com`, companyName: 'Test Co' });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('otp');
    expect(res.body).not.toHaveProperty('code');
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
  });

  it('getLastTestOtp exposes OTP in test mode for testing only', async () => {
    clearLastTestOtp();
    const email = `inspect-${Date.now()}@test.com`;

    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Inspect', lastName: 'User', email, companyName: 'Test Co' });

    const capturedOtp = getLastTestOtp();
    expect(capturedOtp).toBeDefined();
    expect(typeof capturedOtp).toBe('string');
    expect(capturedOtp).toMatch(/^\d{6}$/);
  });

  it('rate limiting works', async () => {
    const base = 'ratelimit';
    const requests = [];
    for (let i = 0; i < 21; i++) {
      requests.push(
        request(app)
          .post('/auth/request-otp')
          .send({ firstName: 'Rate', lastName: 'Limit', email: `${base}-${i}-${Date.now()}@test.com`, companyName: 'Test Co' })
      );
    }

    const results = await Promise.all(requests);
    const rateLimited = results.filter((r) => r.status === 429);

    expect(rateLimited.length).toBeGreaterThanOrEqual(1);
    expect(rateLimited[0].body).toMatchObject({
      success: false,
      message: expect.stringContaining('Too many'),
    });
  });
});
