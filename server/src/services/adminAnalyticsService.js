import { query, execute, queryOne, normalizeEmail } from '../db/helpers.js';
import { ACCESS_LOG_STATUS } from '../constants/accessLog.js';

/**
 * Promote a user to admin by email. Admin-only.
 * @param {object} params
 * @param {string} params.email
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ success: boolean; promoted: boolean; email: string; message: string }}
 */
export function promoteUserToAdmin({ email, db }) {
  const normalized = normalizeEmail(email);
  const user = queryOne('SELECT id, email, is_admin FROM users WHERE email = ?', [normalized], db);

  if (!user) {
    return { success: false, promoted: false, email: normalized, message: 'User not found' };
  }

  if (user.is_admin === 1) {
    return { success: true, promoted: false, email: normalized, message: 'User is already an admin' };
  }

  execute('UPDATE users SET is_admin = 1 WHERE email = ?', [normalized], db);
  return { success: true, promoted: true, email: normalized, message: 'User promoted to admin' };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /admin/access-logs – paginated access logs with user info.
 *
 * @param {object} params
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 * @param {string} [params.email] - filter by user email
 * @param {boolean} [params.activeOnly] - only status = 'active'
 * @param {string} [params.dateFrom] - login_at >= (ISO date or datetime)
 * @param {string} [params.dateTo] - login_at <= (ISO date or datetime)
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function getAccessLogs({ limit = DEFAULT_LIMIT, offset = 0, email, activeOnly, dateFrom, dateTo, db }) {
  const cappedLimit = Math.min(Math.max(1, Number(limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const conditions = [];
  const params = [];

  if (email) {
    conditions.push('u.email = ?');
    params.push(normalizeEmail(email));
  }
  if (activeOnly) {
    conditions.push('a.status = ?');
    params.push(ACCESS_LOG_STATUS.ACTIVE);
  }
  if (dateFrom) {
    conditions.push('a.login_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('a.login_at <= ?');
    params.push(dateTo);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(cappedLimit, safeOffset);

  const rows = query(
    `SELECT
       a.user_id as userId,
       COALESCE(TRIM(u.first_name || ' ' || u.last_name), u.name) as name,
       u.email,
       a.session_id as sessionId,
       a.login_at as loginAt,
       a.logout_at as logoutAt,
       a.last_activity_at as lastActivityAt,
       a.session_seconds as sessionSeconds,
       a.status,
       a.ip_address as ipAddress,
       a.user_agent as userAgent
     FROM access_logs a
     JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.login_at DESC
     LIMIT ? OFFSET ?`,
    params,
    db
  );

  return rows;
}

/**
 * GET /admin/users/access-summary – user-level access summaries.
 *
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function getUsersAccessSummary({ db }) {
  const rows = query(
    `SELECT
       u.id as userId,
       COALESCE(TRIM(u.first_name || ' ' || u.last_name), u.name) as name,
       u.email,
       u.is_admin as isAdmin,
       COALESCE(u.login_count, 0) as loginCount,
       COALESCE(u.total_session_seconds, 0) as totalSessionSeconds,
       u.last_seen_at as lastSeenAt
     FROM users u
     ORDER BY u.last_seen_at DESC, u.email ASC`,
    [],
    db
  );

  return rows;
}

/**
 * GET /admin/active-sessions – sessions/access_logs still active.
 *
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function getActiveSessions({ db }) {
  const now = new Date().toISOString();

  const rows = query(
    `SELECT
       a.user_id as userId,
       COALESCE(TRIM(u.first_name || ' ' || u.last_name), u.name) as name,
       u.email,
       a.session_id as sessionId,
       a.login_at as loginAt,
       a.last_activity_at as lastActivityAt,
       a.ip_address as ipAddress,
       a.user_agent as userAgent
     FROM access_logs a
     JOIN users u ON u.id = a.user_id
     JOIN sessions s ON s.id = a.session_id
     WHERE a.status = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > ?
     ORDER BY a.login_at DESC`,
    [ACCESS_LOG_STATUS.ACTIVE, now],
    db
  );

  return rows;
}
