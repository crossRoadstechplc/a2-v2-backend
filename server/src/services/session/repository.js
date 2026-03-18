import { randomUUID } from 'crypto';
import { execute, queryOne } from '../../db/helpers.js';
import { toIsoTime } from '../../db/helpers.js';

export const SESSION_EXPIRY_HOURS = 4;

/**
 * @param {import('better-sqlite3').Database} [db]
 */
function withDb(db) {
  return { db };
}

/**
 * Create a new session.
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.tokenHash
 * @param {string} [params.userAgent]
 * @param {string} [params.requestIp]
 * @param {string} [params.lastActivityAt] - ISO timestamp for login time
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ sessionId: string; expiresAt: string; lastActivityAt: string }}
 */
export function createSession({ userId, tokenHash, userAgent, requestIp, lastActivityAt, db }) {
  const { db: database } = withDb(db);
  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  const activityAt = lastActivityAt ?? toIsoTime(now);

  execute(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, request_ip, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, tokenHash, toIsoTime(expiresAt), userAgent ?? null, requestIp ?? null, activityAt],
    database
  );

  return { sessionId, expiresAt: toIsoTime(expiresAt), lastActivityAt: activityAt };
}

/**
 * Find a valid session by token hash (not expired, not revoked).
 * @param {object} params
 * @param {string} params.tokenHash
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {object|undefined} Session row with userId, or undefined
 */
export function findSessionByTokenHash({ tokenHash, db }) {
  const { db: database } = withDb(db);
  const now = toIsoTime(new Date());

  return queryOne(
    `SELECT id, user_id as userId, expires_at as expiresAt
     FROM sessions
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    [tokenHash, now],
    database
  );
}

/**
 * Find session by token hash without expiry/revoked check (for validation).
 * @param {object} params
 * @param {string} params.tokenHash
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {object|undefined} Session row or undefined
 */
export function findSessionByTokenHashRaw({ tokenHash, db }) {
  const { db: database } = withDb(db);
  return queryOne(
    `SELECT id, user_id as userId, expires_at as expiresAt, revoked_at as revokedAt
     FROM sessions WHERE token_hash = ?`,
    [tokenHash],
    database
  );
}

/**
 * Revoke a session by token hash.
 * @param {object} params
 * @param {string} params.tokenHash
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function revokeSessionByTokenHash({ tokenHash, db }) {
  const { db: database } = withDb(db);
  const now = toIsoTime(new Date());
  execute(
    'UPDATE sessions SET revoked_at = ? WHERE token_hash = ?',
    [now, tokenHash],
    database
  );
}

/**
 * Update session last_activity_at by token hash.
 * @param {object} params
 * @param {string} params.tokenHash
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {number} Rows affected
 */
export function updateSessionActivityByTokenHash({ tokenHash, db }) {
  const { db: database } = withDb(db);
  const now = toIsoTime(new Date());
  const result = execute(
    'UPDATE sessions SET last_activity_at = ? WHERE token_hash = ?',
    [now, tokenHash],
    database
  );
  return result.changes;
}
