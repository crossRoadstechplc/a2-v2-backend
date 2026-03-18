import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, closeDb } from '../src/db/connection.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query, execute } from '../src/db/helpers.js';
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

async function getAdminToken(email) {
  await request(app)
    .post('/auth/request-otp')
    .send({ firstName: 'Admin', lastName: 'User', email, companyName: 'Test Co' });
  execute('UPDATE users SET is_admin = 1 WHERE email = ?', [email.toLowerCase()]);
  const otp = getLastTestOtp();
  const verifyRes = await request(app)
    .post('/auth/verify-otp')
    .send({ email, otp });
  return verifyRes.body.token;
}

describe('Admin analytics endpoints', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    clearLastTestOtp();
  });

  describe('Auth: admin can access all three endpoints', () => {
    it('admin can access GET /admin/access-logs', async () => {
      const email = `admin-logs-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get('/admin/access-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: expect.any(Array) });
    });

    it('admin can access GET /admin/users/access-summary', async () => {
      const email = `admin-summary-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get('/admin/users/access-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: expect.any(Array) });
    });

    it('admin can access GET /admin/active-sessions', async () => {
      const email = `admin-active-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get('/admin/active-sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: expect.any(Array) });
    });
  });

  describe('Auth: non-admin gets 403', () => {
    it('non-admin gets 403 on GET /admin/access-logs', async () => {
      const email = `nonadmin-logs-${Date.now()}@test.com`;
      const token = await getToken(email);

      const res = await request(app)
        .get('/admin/access-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Admin'),
      });
    });

    it('non-admin gets 403 on GET /admin/users/access-summary', async () => {
      const email = `nonadmin-summary-${Date.now()}@test.com`;
      const token = await getToken(email);

      const res = await request(app)
        .get('/admin/users/access-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('non-admin gets 403 on GET /admin/active-sessions', async () => {
      const email = `nonadmin-active-${Date.now()}@test.com`;
      const token = await getToken(email);

      const res = await request(app)
        .get('/admin/active-sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Auth: unauthenticated gets 401', () => {
    it('unauthenticated gets 401 on GET /admin/access-logs', async () => {
      const res = await request(app).get('/admin/access-logs');
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication'),
      });
    });

    it('unauthenticated gets 401 on GET /admin/users/access-summary', async () => {
      const res = await request(app).get('/admin/users/access-summary');
      expect(res.status).toBe(401);
    });

    it('unauthenticated gets 401 on GET /admin/active-sessions', async () => {
      const res = await request(app).get('/admin/active-sessions');
      expect(res.status).toBe(401);
    });
  });

  describe('Access logs response includes expected fields', () => {
    it('access logs rows have userId, name, email, sessionId, loginAt, logoutAt, lastActivityAt, sessionSeconds, status, ipAddress, userAgent', async () => {
      const email = `logs-fields-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get('/admin/access-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const row = data[0];
        expect(row).toHaveProperty('userId');
        expect(row).toHaveProperty('name');
        expect(row).toHaveProperty('email');
        expect(row).toHaveProperty('sessionId');
        expect(row).toHaveProperty('loginAt');
        expect(row).toHaveProperty('logoutAt');
        expect(row).toHaveProperty('lastActivityAt');
        expect(row).toHaveProperty('sessionSeconds');
        expect(row).toHaveProperty('status');
        expect(row).toHaveProperty('ipAddress');
        expect(row).toHaveProperty('userAgent');
      }
    });
  });

  describe('Access summary response includes expected user totals', () => {
    it('access summary rows have userId, name, email, isAdmin, loginCount, totalSessionSeconds, lastSeenAt', async () => {
      const email = `summary-fields-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get('/admin/users/access-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const row = data[0];
        expect(row).toHaveProperty('userId');
        expect(row).toHaveProperty('name');
        expect(row).toHaveProperty('email');
        expect(row).toHaveProperty('isAdmin');
        expect(row).toHaveProperty('loginCount');
        expect(row).toHaveProperty('totalSessionSeconds');
        expect(row).toHaveProperty('lastSeenAt');
      }
    });
  });

  describe('Active sessions only returns open/active sessions', () => {
    it('active sessions endpoint returns only active sessions', async () => {
      const email = `active-only-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get('/admin/active-sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Array.isArray(data)).toBe(true);

      for (const row of data) {
        const log = query(
          'SELECT status FROM access_logs a JOIN sessions s ON s.id = a.session_id WHERE a.session_id = ?',
          [row.sessionId]
        )[0];
        expect(log?.status).toBe('active');
      }
    });

    it('logged-out sessions do not appear in active-sessions', async () => {
      const email = `logged-out-active-${Date.now()}@test.com`;
      const token = await getToken(email);

      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      const adminEmail = `admin-check-active-${Date.now()}@test.com`;
      const adminToken = await getAdminToken(adminEmail);

      const res = await request(app)
        .get('/admin/active-sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const sessionIds = res.body.data.map((r) => r.sessionId);
      const tokenHash = hashSessionToken(token);
      const session = query('SELECT id FROM sessions WHERE token_hash = ?', [tokenHash])[0];
      expect(sessionIds).not.toContain(session?.id);
    });
  });

  describe('Filters work', () => {
    it('email filter restricts access logs by user email', async () => {
      const email = `filter-email-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get(`/admin/access-logs?email=${encodeURIComponent(email)}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      for (const row of res.body.data) {
        expect(row.email).toBe(email.toLowerCase());
      }
    });

    it('activeOnly filter returns only active logs', async () => {
      const email = `filter-active-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res = await request(app)
        .get('/admin/access-logs?activeOnly=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      for (const row of res.body.data) {
        expect(row.status).toBe('active');
      }
    });

    it('dateFrom and dateTo filter by login_at range', async () => {
      const email = `filter-date-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const dateFrom = '2020-01-01T00:00:00.000Z';
      const dateTo = '2030-12-31T23:59:59.999Z';

      const res = await request(app)
        .get(`/admin/access-logs?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      for (const row of res.body.data) {
        expect(new Date(row.loginAt).getTime()).toBeGreaterThanOrEqual(new Date(dateFrom).getTime());
        expect(new Date(row.loginAt).getTime()).toBeLessThanOrEqual(new Date(dateTo).getTime());
      }
    });

    it('limit and offset pagination work', async () => {
      const email = `filter-paginate-${Date.now()}@test.com`;
      const token = await getAdminToken(email);

      const res1 = await request(app)
        .get('/admin/access-logs?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`);
      const res2 = await request(app)
        .get('/admin/access-logs?limit=2&offset=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.length).toBeLessThanOrEqual(2);
      expect(res2.body.data.length).toBeLessThanOrEqual(2);
      if (res1.body.data.length === 2 && res2.body.data.length >= 1) {
        expect(res1.body.data[0].sessionId).not.toBe(res2.body.data[0].sessionId);
      }
    });
  });

  describe('POST /admin/users/promote', () => {
    it('admin can promote user to admin', async () => {
      const targetEmail = `promote-target-${Date.now()}@test.com`;
      await request(app)
        .post('/auth/request-otp')
        .send({ firstName: 'Target', lastName: 'User', email: targetEmail, companyName: 'Test Co' });

      const adminEmail = `admin-promote-${Date.now()}@test.com`;
      const token = await getAdminToken(adminEmail);

      const res = await request(app)
        .post('/admin/users/promote')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send({ email: targetEmail });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        promoted: true,
        message: 'User promoted to admin',
        email: targetEmail.toLowerCase(),
      });
    });
  });
});
