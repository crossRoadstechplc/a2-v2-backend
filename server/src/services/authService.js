import { getDb } from '../db/connection.js';
import { transaction } from '../db/helpers.js';
import { toIsoTime } from '../db/helpers.js';
import { upsertUser } from './userRepository.js';
import { requestOtp } from './otpService.js';
import {
  getUserByEmail,
  recordLoginAnalytics,
} from './userRepository.js';
import { verifyOtpCode } from './otpService.js';
import {
  generateSessionToken,
  hashSessionToken,
  createSession,
} from './session/index.js';
import { createAccessLog } from './accessLogRepository.js';

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
 * On success: creates session, records login analytics (login_count, last_seen_at),
 * sets sessions.last_activity_at, and creates access_logs row.
 *
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

  const database = db ?? getDb();
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const loginAt = toIsoTime(new Date());

  transaction(
    () => {
      const { sessionId, lastActivityAt } = createSession({
        userId: user.id,
        tokenHash,
        userAgent,
        requestIp,
        lastActivityAt: loginAt,
        db: database,
      });

      recordLoginAnalytics({ userId: user.id, db: database });

      createAccessLog({
        userId: user.id,
        sessionId,
        loginAt,
        lastActivityAt,
        ipAddress: requestIp,
        userAgent,
        db: database,
      });
    },
    database
  );

  return {
    success: true,
    token,
    user: {
      id: user.id,
      firstName: user.first_name ?? user.name?.split(' ')[0] ?? '',
      lastName: user.last_name ?? user.name?.split(' ').slice(1).join(' ') ?? '',
      email: user.email,
      companyName: user.company_name ?? '',
      isAdmin: !!(user.is_admin),
    },
    ndaAccepted: !!user.nda_accepted_at,
    walkthroughSeen: !!user.walkthrough_seen_at,
  };
}
