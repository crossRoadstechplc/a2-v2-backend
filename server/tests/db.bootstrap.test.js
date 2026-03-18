import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrap } from '../src/db/bootstrap.js';
import { normalizeEmail, toIsoTime } from '../src/db/helpers.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('Database bootstrap', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = join(tmpdir(), `a2-test-${randomUUID()}.db`);
    db = new Database(dbPath);
  });

  afterEach(() => {
    db?.close();
  });

  it('creates all tables after bootstrap', () => {
    bootstrap(db);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all()
      .map((r) => r.name);

    expect(tables).toContain('users');
    expect(tables).toContain('otp_codes');
    expect(tables).toContain('sessions');
    expect(tables).toContain('schema_migrations');
  });

  it('enforces unique email on users table', () => {
    bootstrap(db);

    const email = normalizeEmail('Test@Example.COM');
    db.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).run('Alice', email);

    expect(() => {
      db.prepare(
        'INSERT INTO users (name, email) VALUES (?, ?)'
      ).run('Bob', email);
    }).toThrow(/UNIQUE constraint failed/);

    // Different normalized email (same after normalize) - still fails
    expect(() => {
      db.prepare(
        'INSERT INTO users (name, email) VALUES (?, ?)'
      ).run('Charlie', normalizeEmail('test@example.com'));
    }).toThrow(/UNIQUE constraint failed/);
  });

  it('can insert session rows', () => {
    bootstrap(db);

    const userResult = db.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).run('Alice', normalizeEmail('alice@test.com'));

    const userId = userResult.lastInsertRowid;
    const sessionId = randomUUID();
    const expiresAt = toIsoTime(new Date(Date.now() + 3600000));

    db.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, request_ip)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(sessionId, userId, 'hash123', expiresAt, 'Mozilla/5.0', '127.0.0.1');

    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    expect(row).toBeDefined();
    expect(row.user_id).toBe(userId);
    expect(row.token_hash).toBe('hash123');
    expect(row.user_agent).toBe('Mozilla/5.0');
    expect(row.request_ip).toBe('127.0.0.1');
  });

  it('can insert OTP rows', () => {
    bootstrap(db);

    const email = normalizeEmail('otp@test.com');
    const expiresAt = toIsoTime(new Date(Date.now() + 600000));

    db.prepare(
      `INSERT INTO otp_codes (email, code_hash, expires_at, request_ip)
       VALUES (?, ?, ?, ?)`
    ).run(email, 'hashed_otp_abc123', expiresAt, '192.168.1.1');

    const rows = db.prepare('SELECT * FROM otp_codes WHERE email = ?').all(email);
    expect(rows).toHaveLength(1);
    expect(rows[0].code_hash).toBe('hashed_otp_abc123');
    expect(rows[0].used_at).toBeNull();
    expect(rows[0].request_ip).toBe('192.168.1.1');
  });

  it('can update NDA and walkthrough fields on users', () => {
    bootstrap(db);

    const email = normalizeEmail('nda@test.com');
    db.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).run('NDA User', email);

    const ndaAcceptedAt = toIsoTime(new Date());
    const ndaVersion = '1.0';
    const walkthroughSeenAt = toIsoTime(new Date());

    db.prepare(
      `UPDATE users SET nda_accepted_at = ?, nda_version = ?, updated_at = ?
       WHERE email = ?`
    ).run(ndaAcceptedAt, ndaVersion, ndaAcceptedAt, email);

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    expect(user.nda_accepted_at).toBe(ndaAcceptedAt);
    expect(user.nda_version).toBe(ndaVersion);

    db.prepare(
      `UPDATE users SET walkthrough_seen_at = ?, updated_at = ?
       WHERE email = ?`
    ).run(walkthroughSeenAt, walkthroughSeenAt, email);

    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    expect(user.walkthrough_seen_at).toBe(walkthroughSeenAt);
  });
});
