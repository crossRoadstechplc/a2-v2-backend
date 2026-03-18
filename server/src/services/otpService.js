import { generateOtp } from './otp/generator.js';
import { hashOtp, verifyOtp } from './otp/hash.js';
import { createOtp, consumeOtpIfValid } from './otp/repository.js';
import { sendOtpEmail } from './mailer.js';

/**
 * Create and send an OTP. Invalidates previous active OTPs for the email.
 * @param {object} params
 * @param {string} params.email
 * @param {string} [params.firstName] - For personalization in the email
 * @param {string} [params.requestIp]
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {Promise<{ otpId: number; expiresAt: string }>}
 */
export async function requestOtp({ email, firstName, requestIp, db }) {
  const otp = generateOtp();
  const codeHash = hashOtp(otp);

  const { id, expiresAt } = createOtp({ email, codeHash, requestIp, db });

  await sendOtpEmail({ to: email, otp, expiresAt, firstName });

  return { otpId: id, expiresAt };
}

/**
 * Verify an OTP. Single-use: marks as used on success.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.otp - Raw OTP from user
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ valid: boolean }}
 */
export function verifyOtpCode({ email, otp, db }) {
  const codeHash = hashOtp(otp);
  const result = consumeOtpIfValid({ email, codeHash, db });
  return { valid: result.valid };
}

// Re-exports for convenience
export { generateOtp } from './otp/generator.js';
export { hashOtp, verifyOtp } from './otp/hash.js';
export { isOtpExpired } from './otp/repository.js';
