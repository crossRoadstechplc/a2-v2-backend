import { hashSessionToken } from './token.js';
import {
  findSessionByTokenHash,
  findSessionByTokenHashRaw,
  revokeSessionByTokenHash,
} from './repository.js';

/**
 * Validate session token. Returns session if valid, null otherwise.
 * Optionally revokes expired sessions.
 * @param {object} params
 * @param {string} params.token
 * @param {boolean} [params.revokeExpired=true] - Revoke session if expired
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ valid: true; session: object } | { valid: false; reason: 'missing'|'invalid'|'expired'|'revoked' }}
 */
export function validateSessionToken({ token, revokeExpired = true, db }) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'missing' };
  }

  const tokenHash = hashSessionToken(token.trim());
  const session = findSessionByTokenHashRaw({ tokenHash, db });

  if (!session) {
    return { valid: false, reason: 'invalid' };
  }

  if (session.revokedAt) {
    return { valid: false, reason: 'revoked' };
  }

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  if (expiresAt <= now) {
    if (revokeExpired) {
      revokeSessionByTokenHash({ tokenHash, db });
    }
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, session };
}

