import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { bootstrap } from '../src/db/bootstrap.js';
import {
  normalizeEmail,
  toIsoTime,
  query,
  queryOne,
  execute,
  transaction,
} from '../src/db/helpers.js';

describe('DB helpers', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = join(tmpdir(), `a2-test-${randomUUID()}.db`);
    db = new Database(dbPath);
    bootstrap(db);
  });

  afterEach(() => {
    db?.close();
  });

  describe('normalizeEmail', () => {
    it('converts to lowercase', () => {
      expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
    });

    it('trims whitespace', () => {
      expect(normalizeEmail('  user@test.com  ')).toBe('user@test.com');
    });
  });

  describe('toIsoTime', () => {
    it('returns ISO format string', () => {
      const result = toIsoTime(new Date('2025-03-18T12:00:00.000Z'));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result).toContain('Z');
    });
  });

  describe('query/execute with db passed', () => {
    it('query returns rows', () => {
      db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run(
        'Alice',
        'alice@test.com'
      );

      const rows = query('SELECT * FROM users WHERE email = ?', ['alice@test.com'], db);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Alice');
    });

    it('queryOne returns first row', () => {
      const row = queryOne('SELECT 1 as one', [], db);
      expect(row).toEqual({ one: 1 });
    });

    it('execute runs INSERT and returns lastInsertRowid', () => {
      const result = execute(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['Bob', 'bob@test.com'],
        db
      );
      expect(result.lastInsertRowid).toBeDefined();
    });

    it('transaction runs multiple statements atomically', () => {
      transaction(
        () => {
          execute(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            ['T1', 't1@test.com'],
            db
          );
          execute(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            ['T2', 't2@test.com'],
            db
          );
        },
        db
      );

      const count = queryOne('SELECT COUNT(*) as c FROM users', [], db);
      expect(count.c).toBe(2);
    });
  });
});
