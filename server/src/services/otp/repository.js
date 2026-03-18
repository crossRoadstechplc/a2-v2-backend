import { execute, query, queryOne, transaction } from '../../db/helpers.js';
import { normalizeEmail } from '../../db/helpers.js';
import { toIsoTime } from '../../db/helpers.js';

const OTP_EXPIRY_MINUTES = 10;

/**
 * @param {import('better-sqlite3').Database} [db]
 */
function withDb(db) {
  return { db };
}

/**
 * Invalidate all active (unused, unexpired) OTPs for an email.
 * Resend-safe: when a new OTP is requested, old ones become unusable.
 * @param {string} email
 * @param {import('better-sqlite3').Database} [db]
 */
export function invalidateActiveOtps(email, db) {
  const { db: database } = withDb(db);
  const normalized = normalizeEmail(email);
  const now = toIsoTime(new Date());

  execute(
    `UPDATE otp_codes SET used_at = ? WHERE email = ? AND used_at IS NULL AND expires_at > ?`,
    [now, normalized, now],
    database
  );
}

/**
 * Create a new OTP record. Invalidates previous active OTPs for the email.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.codeHash
 * @param {string} [params.requestIp]
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ id: number, expiresAt: string }}
 */
export function createOtp({ email, codeHash, requestIp, db }) {
  const { db: database } = withDb(db);
  const normalized = normalizeEmail(email);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  transaction(
    () => {
      invalidateActiveOtps(normalized, database);
      execute(
        `INSERT INTO otp_codes (email, code_hash, expires_at, request_ip) VALUES (?, ?, ?, ?)`,
        [normalized, codeHash, toIsoTime(expiresAt), requestIp ?? null],
        database
      );
    },
    database
  );

  const row = queryOne(
    `SELECT id, expires_at as expiresAt FROM otp_codes WHERE email = ? ORDER BY id DESC LIMIT 1`,
    [normalized],
    database
  );

  return { id: row.id, expiresAt: row.expiresAt };
}

/**
 * Find a valid (unused, unexpired) OTP by email and verify the code hash.
 * Returns the row if valid; marks it as used.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.codeHash - Hash of the OTP to verify
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ valid: boolean, row?: object }}
 */
export function consumeOtpIfValid({ email, codeHash, db }) {
  const { db: database } = withDb(db);
  const normalized = normalizeEmail(email);
  const now = toIsoTime(new Date());

  const row = queryOne(
    `SELECT id, code_hash FROM otp_codes WHERE email = ? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1`,
    [normalized, now],
    database
  );

  if (!row || row.code_hash !== codeHash) {
    return { valid: false };
  }

  execute(
    `UPDATE otp_codes SET used_at = ? WHERE id = ?`,
    [now, row.id],
    database
  );

  return { valid: true, row };
}

/**
 * Check if an OTP is expired (by expires_at).
 * @param {string} expiresAt - ISO timestamp
 * @returns {boolean}
 */
export function isOtpExpired(expiresAt) {
  return new Date(expiresAt) <= new Date();
}
