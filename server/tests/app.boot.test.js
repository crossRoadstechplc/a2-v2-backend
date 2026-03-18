import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('App boot', () => {
  it('app boots without crashing and responds to requests', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('root path redirects to /health', async () => {
    const res = await request(app).get('/').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/health');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
