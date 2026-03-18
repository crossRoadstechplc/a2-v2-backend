import { describe, it, expect } from 'vitest';
import { hashOtp, verifyOtp } from '../src/services/otp/hash.js';

describe('OTP hash and verification', () => {
  it('hashes OTP to a hex string', () => {
    const hash = hashOtp('123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe('123456');
  });

  it('same OTP produces same hash', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'));
  });

  it('different OTPs produce different hashes', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('654321'));
  });

  it('verifyOtp returns true for matching OTP and hash', () => {
    const otp = '123456';
    const hash = hashOtp(otp);
    expect(verifyOtp(otp, hash)).toBe(true);
  });

  it('verifyOtp returns false for wrong OTP', () => {
    const hash = hashOtp('123456');
    expect(verifyOtp('654321', hash)).toBe(false);
  });

  it('verifyOtp returns false for invalid hash format', () => {
    expect(verifyOtp('123456', 'invalid')).toBe(false);
  });
});
