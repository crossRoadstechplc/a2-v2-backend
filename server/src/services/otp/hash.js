import { createHash, timingSafeEqual } from 'crypto';

const ALGORITHM = 'sha256';
const SALT = 'a2-otp-v1';

/**
 * Hash an OTP for storage. Uses SHA-256 with a salt.
 * @param {string} otp - Raw OTP code
 * @returns {string} Hex-encoded hash
 */
export function hashOtp(otp) {
  const hash = createHash(ALGORITHM);
  hash.update(SALT + String(otp));
  return hash.digest('hex');
}

/**
 * Verify a raw OTP against a stored hash.
 * @param {string} otp - Raw OTP code
 * @param {string} storedHash - Hash from database
 * @returns {boolean}
 */
export function verifyOtp(otp, storedHash) {
  const computed = hashOtp(otp);
  if (computed.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
