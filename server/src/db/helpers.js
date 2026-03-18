import { getDb } from './connection.js';

/**
 * Normalize email to lowercase.
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Get current time in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ).
 * @param {Date} [date]
 * @returns {string}
 */
export function toIsoTime(date = new Date()) {
  return date.toISOString();
}

/**
 * @param {import('better-sqlite3').Database} [database]
 * @returns {import('better-sqlite3').Database}
 */
function resolveDb(database) {
  return database ?? getDb();
}

/**
 * Run a SELECT query and return all rows.
 * @param {string} sql
 * @param {object|array} [params]
 * @param {import('better-sqlite3').Database} [db]
 * @returns {Array<object>}
 */
export function query(sql, params = [], db) {
  const database = resolveDb(db);
  const stmt = database.prepare(sql);
  const bound = Array.isArray(params) ? params : Object.values(params);
  return stmt.all(...bound);
}

/**
 * Run a SELECT query and return the first row or undefined.
 * @param {string} sql
 * @param {object|array} [params]
 * @param {import('better-sqlite3').Database} [db]
 * @returns {object|undefined}
 */
export function queryOne(sql, params = [], db) {
  const rows = query(sql, params, db);
  return rows[0];
}

/**
 * Run an INSERT, UPDATE, or DELETE and return the result info.
 * @param {string} sql
 * @param {object|array} [params]
 * @param {import('better-sqlite3').Database} [db]
 * @returns {import('better-sqlite3').RunResult}
 */
export function execute(sql, params = [], db) {
  const database = resolveDb(db);
  const stmt = database.prepare(sql);
  const bound = Array.isArray(params) ? params : Object.values(params);
  return stmt.run(...bound);
}

/**
 * Run multiple statements in a transaction.
 * @param {() => void} fn
 * @param {import('better-sqlite3').Database} [db]
 */
export function transaction(fn, db) {
  const database = resolveDb(db);
  const txn = database.transaction(fn);
  return txn();
}
