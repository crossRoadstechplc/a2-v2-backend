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

describe('POST /auth/accept-nda', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  it('authenticated user can accept NDA', async () => {
    const email = `nda-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({ ndaVersion: '1.0' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: 'Test User',
      email: email.toLowerCase(),
      ndaAccepted: true,
      ndaVersion: '1.0',
    });
    expect(res.body.ndaAcceptedAt).toBeTruthy();
  });

  it('missing ndaVersion returns 400', async () => {
    const email = `missing-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('unauthenticated user gets 401', async () => {
    const res = await request(app)
      .post('/auth/accept-nda')
      .send({ ndaVersion: '1.0' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Authentication'),
    });
  });

  it('NDA fields are persisted in DB', async () => {
    const email = `persist-${Date.now()}@test.com`;
    const token = await getToken(email);

    await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({ ndaVersion: '2.0' });

    const users = query('SELECT nda_accepted_at, nda_version FROM users WHERE email = ?', [
      email.toLowerCase(),
    ]);
    expect(users).toHaveLength(1);
    expect(users[0].nda_accepted_at).toBeTruthy();
    expect(users[0].nda_version).toBe('2.0');
  });

  it('repeated acceptance with same version is handled cleanly', async () => {
    const email = `repeat-${Date.now()}@test.com`;
    const token = await getToken(email);

    const first = await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({ ndaVersion: '1.0' });

    expect(first.status).toBe(200);
    expect(first.body.ndaAccepted).toBe(true);
    expect(first.body.ndaVersion).toBe('1.0');

    const second = await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({ ndaVersion: '1.0' });

    expect(second.status).toBe(200);
    expect(second.body.ndaAccepted).toBe(true);
    expect(second.body.ndaVersion).toBe('1.0');
  });

  it('response reflects updated NDA status', async () => {
    const email = `reflect-${Date.now()}@test.com`;
    const token = await getToken(email);

    const res = await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({ ndaVersion: '3.0' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ndaAccepted: true,
      ndaAcceptedAt: expect.any(String),
      ndaVersion: '3.0',
    });
  });

  it('newer version updates nda_version and timestamp', async () => {
    const email = `newer-${Date.now()}@test.com`;
    const token = await getToken(email);

    const first = await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({ ndaVersion: '1.0' });

    const second = await request(app)
      .post('/auth/accept-nda')
      .set('Authorization', `Bearer ${token}`)
      .send({ ndaVersion: '2.0' });

    expect(second.status).toBe(200);
    expect(second.body.ndaVersion).toBe('2.0');
    expect(second.body.ndaAcceptedAt).toBeTruthy();
  });
});
