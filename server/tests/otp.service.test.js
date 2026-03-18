import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { bootstrap } from '../src/db/bootstrap.js';
import { requestOtp, verifyOtpCode } from '../src/services/otpService.js';
import { getLastTestOtp, clearLastTestOtp } from '../src/services/mailer.js';
import { query } from '../src/db/helpers.js';

describe('OTP service', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = join(tmpdir(), `a2-test-${randomUUID()}.db`);
    db = new Database(dbPath);
    bootstrap(db);
    clearLastTestOtp();
  });

  afterEach(() => {
    db?.close();
  });

  it('stores hashed OTP, not raw OTP', async () => {
    const email = 'hash@test.com';
    await requestOtp({ email, db });

    const rows = query('SELECT code_hash FROM otp_codes WHERE email = ?', [
      email,
    ], db);
    expect(rows).toHaveLength(1);

    const rawOtp = getLastTestOtp();
    expect(rawOtp).toBeDefined();
    expect(rows[0].code_hash).not.toBe(rawOtp);
    expect(rows[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('requestOtp returns otpId and expiresAt', async () => {
    const result = await requestOtp({ email: 'req@test.com', db });
    expect(result).toHaveProperty('otpId');
    expect(result).toHaveProperty('expiresAt');
    expect(typeof result.otpId).toBe('number');
    expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('verifyOtpCode validates correct OTP', async () => {
    const email = 'verify@test.com';
    await requestOtp({ email, db });
    const otp = getLastTestOtp();
    expect(otp).toBeDefined();

    const result = verifyOtpCode({ email, otp, db });
    expect(result.valid).toBe(true);
  });

  it('verifyOtpCode rejects wrong OTP', async () => {
    const email = 'wrong@test.com';
    await requestOtp({ email, db });

    const result = verifyOtpCode({ email, otp: '000000', db });
    expect(result.valid).toBe(false);
  });
});
