import { validateSessionToken } from '../services/session/validate.js';
import { getUserById } from '../services/userRepository.js';

/**
 * Extract Bearer token from Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getBearerToken(req) {
  const auth = req.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

/**
 * Auth middleware. Validates session token and attaches user to req.user.
 * Returns 401 for missing, invalid, expired, or revoked tokens.
 */
export function requireAuth(req, res, next) {
  const token = getBearerToken(req);

  const result = validateSessionToken({ token, revokeExpired: true });

  if (!result.valid) {
    const message =
      result.reason === 'missing'
        ? 'Authentication required.'
        : 'Invalid or expired session.';
    return res.status(401).json({ success: false, message });
  }

  const user = getUserById({ userId: result.session.userId });
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }

  req.user = user;
  req.token = token;
  next();
}
