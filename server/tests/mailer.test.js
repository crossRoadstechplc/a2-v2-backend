import { describe, it, expect, beforeEach } from 'vitest';
import {
  sendOtpEmail,
  getLastTestOtp,
  clearLastTestOtp,
} from '../src/services/mailer.js';

describe('Mailer', () => {
  beforeEach(() => {
    clearLastTestOtp();
  });

  it('can run in test mode without external SMTP', async () => {
    const result = await sendOtpEmail({
      to: 'test@example.com',
      otp: '123456',
    });

    expect(result.sent).toBe(false);
    expect(result.capturedOtp).toBe('123456');
  });

  it('captures OTP for inspection in test mode', async () => {
    await sendOtpEmail({ to: 'a@b.com', otp: '654321' });

    expect(getLastTestOtp()).toBe('654321');
  });

  it('clearLastTestOtp clears captured OTP', async () => {
    await sendOtpEmail({ to: 'a@b.com', otp: '999999' });
    expect(getLastTestOtp()).toBe('999999');

    clearLastTestOtp();
    expect(getLastTestOtp()).toBeNull();
  });
});
