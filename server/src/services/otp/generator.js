import { randomInt } from 'crypto';

const OTP_LENGTH = 6;
const MIN = 0;
const MAX = 10 ** OTP_LENGTH - 1; // 999999

/**
 * Generate a 6-digit numeric OTP.
 * @returns {string} 6-digit OTP (e.g. "123456")
 */
export function generateOtp() {
  const num = randomInt(MIN, MAX + 1);
  return String(num).padStart(OTP_LENGTH, '0');
}
