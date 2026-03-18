import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { requestOtpSchema } from '../validators/requestOtp.js';
import { verifyOtpSchema } from '../validators/verifyOtp.js';
import { acceptNdaSchema } from '../validators/acceptNda.js';
import { requestOtp, verifyOtp, getMe, acceptNdaHandler, completeWalkthroughHandler, logout } from '../controllers/auth.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.otpRequestLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  },
});

authRouter.post(
  '/request-otp',
  otpRateLimiter,
  validate(requestOtpSchema),
  requestOtp
);

authRouter.post(
  '/verify-otp',
  validate(verifyOtpSchema),
  verifyOtp
);

authRouter.get('/me', requireAuth, getMe);

authRouter.post(
  '/accept-nda',
  requireAuth,
  validate(acceptNdaSchema),
  acceptNdaHandler
);

authRouter.post('/complete-walkthrough', requireAuth, completeWalkthroughHandler);

authRouter.post('/logout', requireAuth, logout);
