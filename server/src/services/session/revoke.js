import { hashSessionToken } from './token.js';
import { revokeSessionByTokenHash } from './repository.js';

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
