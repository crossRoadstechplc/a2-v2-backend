import { Router } from 'express';
import { config } from '../config/env.js';
import { getLastTestOtpForEmail } from '../services/mailer.js';
import { normalizeEmail } from '../db/helpers.js';
import { execute, queryOne } from '../db/helpers.js';

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

/**
 * GET /test/promote-admin?email=...
 * Dev/test only. Promotes user to admin (sets users.is_admin = 1).
 */
testRouter.get('/promote-admin', (req, res) => {
  const email = req.query.email;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email query parameter is required' });
  }

  const normalized = normalizeEmail(email);
  const user = queryOne('SELECT id, email, is_admin FROM users WHERE email = ?', [normalized]);

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      email: normalized,
    });
  }

  if (user.is_admin === 1) {
    return res.status(200).json({
      success: true,
      message: 'User is already an admin.',
      email: normalized,
    });
  }

  execute('UPDATE users SET is_admin = 1 WHERE email = ?', [normalized]);

  res.status(200).json({
    success: true,
    message: 'User promoted to admin.',
    email: normalized,
  });
});
