import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, closeDb, getDb } from '../src/db/connection.js';

describe('Database connection and init', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  it('initDb initializes successfully and creates tables', () => {
    const db = getDb();
    expect(db).toBeDefined();

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all()
      .map((r) => r.name);

    expect(tables).toContain('users');
    expect(tables).toContain('otp_codes');
    expect(tables).toContain('sessions');
  });
});
