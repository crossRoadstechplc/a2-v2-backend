import { requestOtpForAuth, verifyOtpForAuth } from '../services/authService.js';
import { acceptNda, completeWalkthrough } from '../services/userRepository.js';
import { revokeCurrentSession } from '../services/session/revoke.js';
import { formatUser, successMessage } from '../utils/responseFormats.js';

/**
 * POST /auth/request-otp
 * Request OTP for authentication. Creates user if first time, updates name if needed.
 */
export async function requestOtp(req, res, next) {
  try {
    const { firstName, lastName, email, companyName } = req.validated;
    const requestIp = req.ip ?? req.socket?.remoteAddress;

    const result = await requestOtpForAuth({ firstName, lastName, email, companyName, requestIp });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/verify-otp
 * Verify OTP and create session. Returns token and user summary.
 */
export async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.validated;
    const requestIp = req.ip ?? req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = verifyOtpForAuth({ email, otp, userAgent, requestIp });

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired verification code.',
      });
    }

    res.status(200).json({
      success: true,
      token: result.token,
      user: result.user,
      ndaAccepted: result.ndaAccepted,
      walkthroughSeen: result.walkthroughSeen,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/me
 * Return current authenticated user.
 */
export function getMe(req, res, next) {
  try {
    res.status(200).json(formatUser(req.user));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/accept-nda
 * Accept NDA for authenticated user.
 */
export function acceptNdaHandler(req, res, next) {
  try {
    const { ndaVersion } = req.validated;
    const user = acceptNda({ userId: req.user.id, ndaVersion });

    res.status(200).json(formatUser(user));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/complete-walkthrough
 * Mark walkthrough as completed for authenticated user.
 */
export function completeWalkthroughHandler(req, res, next) {
  try {
    const user = completeWalkthrough({ userId: req.user.id });

    res.status(200).json(formatUser(user));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 * Revoke the current session.
 */
export function logout(req, res, next) {
  try {
    revokeCurrentSession({ token: req.token });

    res.status(200).json(successMessage('Logged out successfully.'));
  } catch (err) {
    next(err);
  }
}
