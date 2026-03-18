import { hashSessionToken } from './token.js';
import { findSessionByTokenHash, revokeSessionByTokenHash } from './repository.js';
import { finalizeAccessLogForSession } from '../accessLogRepository.js';
import { toIsoTime } from '../../db/helpers.js';
import { ACCESS_LOG_STATUS } from '../../constants/accessLog.js';

/**
 * Revoke the current session (by token).
 * @param {object} params
 * @param {string} params.token - Raw session token
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function revokeCurrentSession({ token, db }) {
  const tokenHash = hashSessionToken(token);
  revokeSessionByTokenHash({ tokenHash, db });
}

/**
 * Finalize access log and revoke session (for logout).
 * Idempotent: finalization only runs if access_log status is 'active'.
 * Double logout: session already revoked → findSessionByTokenHash returns null → skip finalization → revoke is no-op.
 *
 * @param {object} params
 * @param {string} params.token - Raw session token
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function logoutWithFinalization({ token, db }) {
  const tokenHash = hashSessionToken(token);
  const session = findSessionByTokenHash({ tokenHash, db });

  if (session) {
    finalizeAccessLogForSession({
      sessionId: session.id,
      userId: session.userId,
      endTime: toIsoTime(new Date()),
      status: ACCESS_LOG_STATUS.LOGGED_OUT,
      db,
    });
  }

  revokeSessionByTokenHash({ tokenHash, db });
}

/**
 * Revoke all sessions for a user. Future-friendly placeholder.
 * Not implemented yet - use revokeCurrentSession for logout.
 * @param {object} params
 * @param {number} params.userId
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function revokeAllSessionsForUser({ userId, db }) {
  // TODO: implement when "logout everywhere" is needed
  // execute('UPDATE sessions SET revoked_at = ? WHERE user_id = ?', [now, userId], db);
  throw new Error('revokeAllSessionsForUser not implemented');
}
