import { randomBytes, createHash, timingSafeEqual } from 'crypto';

const TOKEN_BYTES = 32;
const ALGORITHM = 'sha256';
const SALT = 'a2-session-v1';

/**
 * Generate a secure random session token.
 * @returns {string} Hex-encoded token (64 chars)
 */
export function generateSessionToken() {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Hash a session token for storage.
 * @param {string} token - Raw token
 * @returns {string} Hex-encoded hash
 */
export function hashSessionToken(token) {
  const hash = createHash(ALGORITHM);
  hash.update(SALT + String(token));
  return hash.digest('hex');
}

/**
 * Verify a raw token against a stored hash.
 * @param {string} token - Raw token from client
 * @param {string} storedHash - Hash from database
 * @returns {boolean}
 */
export function verifySessionToken(token, storedHash) {
  const computed = hashSessionToken(token);
  if (computed.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
