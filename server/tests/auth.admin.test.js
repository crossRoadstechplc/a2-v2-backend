import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { execute } from '../src/db/helpers.js';

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

describe('Admin middleware', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('admin user passes admin middleware', async () => {
    const email = `admin-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Admin', lastName: 'User', email, companyName: 'Test Co' });

    execute('UPDATE users SET is_admin = 1 WHERE email = ?', [email.toLowerCase()]);

    const otp = getLastTestOtp();
    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });
    const token = verifyRes.body.token;

    const res = await request(app)
      .get('/admin/check')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Admin access granted.' });
  });

  it('authenticated non-admin gets 403', async () => {
    const email = `nonadmin-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .get('/admin/check')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Admin'),
    });
  });

  it('unauthenticated request gets 401', async () => {
    const res = await request(app).get('/admin/check');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Authentication'),
    });
  });
});

describe('Current user includes admin flag', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('GET /auth/me includes isAdmin in response', async () => {
    const email = `me-admin-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isAdmin');
    expect(typeof res.body.isAdmin).toBe('boolean');
    expect(res.body.isAdmin).toBe(false);
  });

  it('GET /auth/me returns isAdmin true for admin user', async () => {
    const email = `me-admin-true-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Admin', lastName: 'User', email, companyName: 'Test Co' });

    execute('UPDATE users SET is_admin = 1 WHERE email = ?', [email.toLowerCase()]);

    const otp = getLastTestOtp();
    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });
    const token = verifyRes.body.token;

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
  });

  it('POST /auth/verify-otp user object includes isAdmin', async () => {
    const email = `verify-admin-${Date.now()}@test.com`;
    await request(app)
      .post('/auth/request-otp')
      .send({ firstName: 'Verify', lastName: 'Admin', email, companyName: 'Test Co' });

    execute('UPDATE users SET is_admin = 1 WHERE email = ?', [email.toLowerCase()]);

    const otp = getLastTestOtp();
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email, otp });

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('isAdmin');
    expect(res.body.user.isAdmin).toBe(true);
  });
});
