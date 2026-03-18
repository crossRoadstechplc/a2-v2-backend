import { Router } from 'express';
import { config } from '../config/env.js';
import { getLastTestOtpForEmail } from '../services/mailer.js';
import { normalizeEmail } from '../db/helpers.js';

/**
 * Guard: test routes must NEVER be enabled in production.
 * This is an explicit environment check.
 */
function requireDevOrTest(_req, res, next) {
  if (!config.isDevOrTest) {
    return res.status(404).json({ error: 'Not Found' });
  }
  next();
}

export const testRouter = Router({ mergeParams: false });

testRouter.use(requireDevOrTest);

/**
 * GET /test/latest-otp?email=...
 * Dev/test only. Returns latest captured OTP for email.
 */
testRouter.get('/latest-otp', (req, res) => {
  const email = req.query.email;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email query parameter is required' });
  }

  const normalized = normalizeEmail(email);
  const entry = getLastTestOtpForEmail(normalized);

  if (!entry) {
    return res.status(404).json({
      error: 'No OTP found for this email',
      email: normalized,
    });
  }

  res.status(200).json({
    email: normalized,
    otp: entry.otp,
    expiresAt: entry.expiresAt,
  });
});
