import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { bootstrap } from '../src/db/bootstrap.js';
import { hashOtp } from '../src/services/otp/hash.js';
import { createOtp, consumeOtpIfValid } from '../src/services/otp/repository.js';
import { normalizeEmail } from '../src/db/helpers.js';

describe('OTP resend invalidates previous', () => {
  let db;
  let dbPath;
  const email = 'resend@test.com';

  beforeEach(() => {
    dbPath = join(tmpdir(), `a2-test-${randomUUID()}.db`);
    db = new Database(dbPath);
    bootstrap(db);
  });

  afterEach(() => {
    db?.close();
  });

  it('creating a new OTP invalidates previous active OTPs', () => {
    const otp1 = '111111';
    const otp2 = '222222';
    const hash1 = hashOtp(otp1);
    const hash2 = hashOtp(otp2);

    createOtp({ email, codeHash: hash1, db });
    createOtp({ email, codeHash: hash2, db });

    // First OTP should be invalid (invalidated by resend)
    const result1 = consumeOtpIfValid({ email, codeHash: hash1, db });
    expect(result1.valid).toBe(false);

    // Second OTP should be valid
    const result2 = consumeOtpIfValid({ email, codeHash: hash2, db });
    expect(result2.valid).toBe(true);
  });

  it('second OTP is single-use after consume', () => {
    const otp = '333333';
    const hash = hashOtp(otp);
    createOtp({ email, codeHash: hash, db });

    const first = consumeOtpIfValid({ email, codeHash: hash, db });
    expect(first.valid).toBe(true);

    const second = consumeOtpIfValid({ email, codeHash: hash, db });
    expect(second.valid).toBe(false);
  });
});
