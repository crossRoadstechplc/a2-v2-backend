import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { bootstrap } from '../src/db/bootstrap.js';
import { hashOtp } from '../src/services/otp/hash.js';
import { createOtp, consumeOtpIfValid, isOtpExpired } from '../src/services/otp/repository.js';
import { toIsoTime } from '../src/db/helpers.js';

describe('OTP expiry', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = join(tmpdir(), `a2-test-${randomUUID()}.db`);
    db = new Database(dbPath);
    bootstrap(db);
  });

  afterEach(() => {
    db?.close();
  });

  it('isOtpExpired returns true for past timestamp', () => {
    const past = new Date(Date.now() - 60000);
    expect(isOtpExpired(toIsoTime(past))).toBe(true);
  });

  it('isOtpExpired returns false for future timestamp', () => {
    const future = new Date(Date.now() + 600000);
    expect(isOtpExpired(toIsoTime(future))).toBe(false);
  });

  it('expired OTP cannot be consumed', () => {
    const email = 'expired@test.com';
    const otp = '123456';
    const hash = hashOtp(otp);
    const past = new Date(Date.now() - 60000);

    db.prepare(
      `INSERT INTO otp_codes (email, code_hash, expires_at) VALUES (?, ?, ?)`
    ).run(email, hash, toIsoTime(past));

    const result = consumeOtpIfValid({ email, codeHash: hash, db });
    expect(result.valid).toBe(false);
  });
});
