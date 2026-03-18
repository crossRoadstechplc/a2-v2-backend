import { execute, queryOne, toIsoTime } from '../db/helpers.js';
import { ACCESS_LOG_STATUS } from '../constants/accessLog.js';

/**
 * Create an access log row for a successful login.
 * Status starts as ACTIVE; finalization (logout/expiry) transitions to LOGGED_OUT or EXPIRED.
 *
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.sessionId
 * @param {string} params.loginAt - ISO timestamp
 * @param {string} params.lastActivityAt - ISO timestamp
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function createAccessLog({
  userId,
  sessionId,
  loginAt,
  lastActivityAt,
  ipAddress,
  userAgent,
  db,
}) {
  execute(
    `INSERT INTO access_logs (user_id, session_id, login_at, last_activity_at, ip_address, user_agent, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      sessionId,
      loginAt,
      lastActivityAt,
      ipAddress ?? null,
      userAgent ?? null,
      ACCESS_LOG_STATUS.ACTIVE,
    ],
    db
  );
}

/**
 * Update access_logs.last_activity_at for the active session.
 * Lightweight: single UPDATE, only touches rows with status = 'active'.
 * Safe: no new rows, no accumulation; idempotent.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {number} Rows affected
 */
export function updateAccessLogActivityBySessionId({ sessionId, db }) {
  const now = toIsoTime(new Date());
  const result = execute(
    `UPDATE access_logs SET last_activity_at = ? WHERE session_id = ? AND status = ?`,
    [now, sessionId, ACCESS_LOG_STATUS.ACTIVE],
    db
  );
  return result.changes;
}

/**
 * Finalize an active access log: set logout_at, session_seconds, status.
 * Accumulates session_seconds into users.total_session_seconds.
 *
 * Idempotent: only updates rows with status = 'active'. Repeated calls (e.g. double logout)
 * return { finalized: false } and do not double-count session time.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {number} params.userId
 * @param {string} params.endTime - ISO timestamp (logout or expiry time)
 * @param {string} params.status - ACCESS_LOG_STATUS.LOGGED_OUT or ACCESS_LOG_STATUS.EXPIRED
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ finalized: boolean; sessionSeconds: number }}
 */
export function finalizeAccessLogForSession({ sessionId, userId, endTime, status, db }) {
  const log = queryOne(
    `SELECT id, login_at, last_activity_at FROM access_logs WHERE session_id = ? AND status = ?`,
    [sessionId, ACCESS_LOG_STATUS.ACTIVE],
    db
  );

  if (!log) {
    return { finalized: false, sessionSeconds: 0 };
  }

  const endMs = new Date(endTime).getTime();
  const loginMs = new Date(log.login_at).getTime();
  const lastActivityMs = log.last_activity_at ? new Date(log.last_activity_at).getTime() : null;
  const effectiveEndMs = lastActivityMs != null && lastActivityMs > loginMs ? lastActivityMs : endMs;
  const sessionSeconds = Math.max(0, Math.floor((effectiveEndMs - loginMs) / 1000));

  execute(
    'UPDATE access_logs SET logout_at = ?, session_seconds = ?, status = ? WHERE id = ?',
    [endTime, sessionSeconds, status, log.id],
    db
  );

  execute(
    'UPDATE users SET total_session_seconds = COALESCE(total_session_seconds, 0) + ? WHERE id = ?',
    [sessionSeconds, userId],
    db
  );

  return { finalized: true, sessionSeconds };
}
