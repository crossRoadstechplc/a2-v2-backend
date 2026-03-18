import { describe, it, expect } from 'vitest';
import { generateOtp } from '../src/services/otp/generator.js';

describe('OTP generator', () => {
  it('returns a 6-digit numeric code', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp).toHaveLength(6);
    }
  });

  it('generates different codes on each call', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(generateOtp());
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});
