import { hashSessionToken } from './session/token.js';
import { findSessionByTokenHash, updateSessionActivityByTokenHash } from './session/repository.js';
import { updateAccessLogActivityBySessionId } from './accessLogRepository.js';
import { updateLastSeenAt } from './userRepository.js';

/**
 * Record heartbeat: update session, access_log, and user activity timestamps.
 * Lightweight – no new rows, only updates existing.
 *
 * @param {object} params
 * @param {string} params.token - Raw Bearer token
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ success: boolean }} - success if session was found and updated
 */
export function recordHeartbeat({ token, db }) {
  const tokenHash = hashSessionToken(token);
  const session = findSessionByTokenHash({ tokenHash, db });

  if (!session) {
    return { success: false };
  }

  updateSessionActivityByTokenHash({ tokenHash, db });
  updateAccessLogActivityBySessionId({ sessionId: session.id, db });
  updateLastSeenAt({ userId: session.userId, db });

  return { success: true };
}
