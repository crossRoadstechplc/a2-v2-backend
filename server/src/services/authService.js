import { upsertUser } from './userRepository.js';
import { requestOtp } from './otpService.js';
import {
  getUserByEmail,
  updateLastLogin,
} from './userRepository.js';
import { verifyOtpCode } from './otpService.js';
import {
  generateSessionToken,
  hashSessionToken,
  createSession,
} from './session/index.js';

/**
 * Request OTP for auth. Creates/updates user, generates and sends OTP.
 * Does not reveal whether user existed before.
 * @param {object} params
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.email
 * @param {string} params.companyName
 * @param {string} [params.requestIp]
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {Promise<{ success: boolean; message: string }>}
 */
export async function requestOtpForAuth({ firstName, lastName, email, companyName, requestIp, db }) {
  upsertUser({ firstName, lastName, email, companyName, db });
  await requestOtp({ email, firstName, requestIp, db });

  return {
    success: true,
    message: 'If an account exists for this email, a verification code has been sent.',
  };
}

/**
 * Verify OTP and create session. Returns token and user summary.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.otp
 * @param {string} [params.userAgent]
 * @param {string} [params.requestIp]
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ success: true; token: string; user: object; ndaAccepted: boolean; walkthroughSeen: boolean } | { success: false; status: 401 }}
 */
export function verifyOtpForAuth({ email, otp, userAgent, requestIp, db }) {
  const { valid } = verifyOtpCode({ email, otp, db });
  if (!valid) {
    return { success: false, status: 401 };
  }

  const user = getUserByEmail({ email, db });
  if (!user) {
    return { success: false, status: 401 };
  }

  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  createSession({
    userId: user.id,
    tokenHash,
    userAgent,
    requestIp,
    db,
  });

  updateLastLogin({ userId: user.id, db });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      firstName: user.first_name ?? user.name?.split(' ')[0] ?? '',
      lastName: user.last_name ?? user.name?.split(' ').slice(1).join(' ') ?? '',
      email: user.email,
      companyName: user.company_name ?? '',
    },
    ndaAccepted: !!user.nda_accepted_at,
    walkthroughSeen: !!user.walkthrough_seen_at,
  };
}
