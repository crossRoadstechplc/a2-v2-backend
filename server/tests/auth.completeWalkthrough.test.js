import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query } from '../src/db/helpers.js';

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

describe('POST /auth/complete-walkthrough', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('authenticated user can complete walkthrough', async () => {
    const email = `walk-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .post('/auth/complete-walkthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: 'Test User',
      email: email.toLowerCase(),
      walkthroughSeen: true,
    });
    expect(res.body.walkthroughSeenAt).toBeTruthy();
  });

  it('unauthenticated user gets 401', async () => {
    const res = await request(app).post('/auth/complete-walkthrough');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Authentication'),
    });
  });

  it('walkthrough field persists in DB', async () => {
    const email = `persist-${Date.now()}@test.com`;
    const token = await getToken(email);

    await request(app)
      .post('/auth/complete-walkthrough')
      .set('Authorization', `Bearer ${token}`);

    const users = query('SELECT walkthrough_seen_at FROM users WHERE email = ?', [
      email.toLowerCase(),
    ]);
    expect(users).toHaveLength(1);
    expect(users[0].walkthrough_seen_at).toBeTruthy();
  });

  it('repeated completion works and does not fail', async () => {
    const email = `repeat-${Date.now()}@test.com`;
    const token = await getToken(email);

    const first = await request(app)
      .post('/auth/complete-walkthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(first.body.walkthroughSeen).toBe(true);

    const second = await request(app)
      .post('/auth/complete-walkthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(200);
    expect(second.body.walkthroughSeen).toBe(true);
  });

  it('GET /auth/me reflects walkthrough completion', async () => {
    const email = `me-reflect-${Date.now()}@test.com`;
    const token = await getToken(email);

    await request(app)
      .post('/auth/complete-walkthrough')
      .set('Authorization', `Bearer ${token}`);

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.walkthroughSeen).toBe(true);
    expect(meRes.body.walkthroughSeenAt).toBeTruthy();
  });
});
