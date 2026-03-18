import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';

describe('GET /test/latest-otp (dev/test only)', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('helper works in test mode', async () => {
    const email = `helper-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Helper', lastName: 'User', email, companyName: 'Test Co' });

    const res = await request(app).get(`/test/latest-otp?email=${encodeURIComponent(email)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: email.toLowerCase(),
      otp: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(res.body.otp).toMatch(/^\d{6}$/);
  });

  it('helper returns latest valid OTP for test email', async () => {
    const email = `latest-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Latest', lastName: 'User', email, companyName: 'Test Co' });

    const otpFromMailer = getLastTestOtp();
    const res = await request(app).get(`/test/latest-otp?email=${encodeURIComponent(email)}`);

    expect(res.status).toBe(200);
    expect(res.body.otp).toBe(otpFromMailer);
  });

  it('returns 404 when no OTP for email', async () => {
    const res = await request(app).get(
      '/test/latest-otp?email=nonexistent@never-requested.com'
    );

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: expect.stringContaining('No OTP'),
      email: 'nonexistent@never-requested.com',
    });
    expect(res.body).not.toHaveProperty('otp');
  });

  it('no OTP leakage in 404 response', async () => {
    const res = await request(app).get(
      '/test/latest-otp?email=unknown@test.com'
    );

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
  });

  it('returns 400 when email missing', async () => {
    const res = await request(app).get('/test/latest-otp');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required|email/i);
  });
});

describe('GET /test/promote-admin (dev/test only)', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('promotes user to admin', async () => {
    const email = `promote-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Promote', lastName: 'User', email, companyName: 'Test Co' });

    const res = await request(app).get(`/test/promote-admin?email=${encodeURIComponent(email)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'User promoted to admin.',
      email: email.toLowerCase(),
    });
  });

  it('returns already admin when user is already admin', async () => {
    const email = `already-admin-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Admin', lastName: 'User', email, companyName: 'Test Co' });
    const { execute } = await import('../src/db/helpers.js');
    execute('UPDATE users SET is_admin = 1 WHERE email = ?', [email.toLowerCase()]);

    const res = await request(app).get(`/test/promote-admin?email=${encodeURIComponent(email)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'User is already an admin.',
      email: email.toLowerCase(),
    });
  });

  it('returns 404 when user not found', async () => {
    const res = await request(app).get(
      '/test/promote-admin?email=nonexistent@never-registered.com'
    );

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: 'User not found',
      email: 'nonexistent@never-registered.com',
    });
  });

  it('returns 400 when email missing', async () => {
    const res = await request(app).get('/test/promote-admin');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required|email/i);
  });
});

describe('GET /test/latest-otp production guard', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.resetModules();
  });

  it('helper is blocked in production mode', async () => {
    process.env.NODE_ENV = 'production';
    vi.resetModules();

    const { default: appProd } = await import('../src/app.js');
    const res = await request(appProd).get('/test/latest-otp?email=test@example.com');

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('otp');
  });
});

describe('GET /test/promote-admin production guard', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.resetModules();
  });

  it('promote-admin is blocked in production mode', async () => {
    process.env.NODE_ENV = 'production';
    vi.resetModules();

    const { default: appProd } = await import('../src/app.js');
    const res = await request(appProd).get('/test/promote-admin?email=test@example.com');

    expect(res.status).toBe(404);
  });
});
