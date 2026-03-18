import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { normalizeEmail } from '../db/helpers.js';

let transporter = null;
let lastTestOtp = null;
/** @type {Record<string, { otp: string; expiresAt: string }>} */
let lastTestOtpsByEmail = {};

/**
 * Whether we're in a mode that captures OTP instead of sending.
 */
function isCaptureMode() {
  return config.mailTestMode || config.nodeEnv === 'test';
}

/**
 * Build plain-text OTP email body.
 * @param {{ greeting: string; otp: string }} params
 */
function buildOtpTextEmail({ greeting, otp }) {
  return `${greeting}

You requested access to the A2 Simulator. Use the verification code below to sign in.

Your verification code:

  ${otp}

This code expires in 10 minutes. Do not share it with anyone.

If you did not request this code, you can safely ignore this email.

—
A2 Simulator Team`;
}

/**
 * Build HTML OTP email body with OTP prominently displayed for easy copy.
 * @param {{ greeting: string; otp: string }} params
 */
function buildOtpHtmlEmail({ greeting, otp }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 16px; margin-bottom: 20px;">${greeting}</p>
  <p style="font-size: 16px; margin-bottom: 20px;">You requested access to the <strong>A2 Simulator</strong>. Use the verification code below to sign in.</p>
  <p style="font-size: 16px; margin-bottom: 12px;">Your verification code:</p>
  <div style="background: #f5f5f5; border: 2px solid #333; border-radius: 8px; padding: 20px 24px; margin: 16px 0 24px; text-align: center;">
    <code style="font-size: 28px; font-weight: 700; letter-spacing: 6px; font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;">${otp}</code>
  </div>
  <p style="font-size: 14px; color: #666; margin-bottom: 8px;">This code expires in 10 minutes. Do not share it with anyone.</p>
  <p style="font-size: 14px; color: #666;">If you did not request this code, you can safely ignore this email.</p>
  <p style="font-size: 12px; color: #999; margin-top: 32px;">— A2 Simulator Team</p>
</body>
</html>`.trim();
}

/**
 * Get or create the Nodemailer transporter.
 */
function getTransporter() {
  if (!transporter) {
    if (isCaptureMode()) {
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    } else {
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth:
          config.smtp.user && config.smtp.pass
            ? { user: config.smtp.user, pass: config.smtp.pass }
            : undefined,
      });
    }
  }
  return transporter;
}

/**
 * Send an OTP email. In test/dev mode, captures OTP instead of sending.
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.otp - Raw OTP code (for capture mode)
 * @param {string} [params.expiresAt] - ISO expiry for OTP
 * @param {string} [params.firstName] - For personalization
 * @param {string} [params.subject] - Email subject
 * @param {string} [params.html] - HTML body
 * @param {string} [params.text] - Plain text body
 * @returns {Promise<{ sent: boolean; capturedOtp?: string }>}
 */
export async function sendOtpEmail({ to, otp, expiresAt, firstName, subject, html, text }) {
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi,';
  const subj = subject ?? 'Your A2 Simulator verification code';
  const txt = text ?? buildOtpTextEmail({ greeting, otp });
  const htm = html ?? buildOtpHtmlEmail({ greeting, otp });

  if (isCaptureMode()) {
    lastTestOtp = otp;
    const normalized = normalizeEmail(to);
    lastTestOtpsByEmail[normalized] = { otp, expiresAt: expiresAt ?? '' };
    return { sent: false, capturedOtp: otp };
  }

  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject: subj,
    text: txt,
    html: htm,
  });

  return { sent: true };
}

/**
 * Get the last OTP captured in test/dev mode. For tests to inspect.
 * @returns {string|null}
 */
export function getLastTestOtp() {
  return lastTestOtp ?? null;
}

/**
 * Clear the captured OTP (call between tests).
 */
export function clearLastTestOtp() {
  lastTestOtp = null;
  lastTestOtpsByEmail = {};
}

/**
 * Get last OTP for email in test/dev mode. For test helper only.
 * @param {string} email
 * @returns {{ otp: string; expiresAt: string }|null}
 */
export function getLastTestOtpForEmail(email) {
  const normalized = normalizeEmail(email);
  const entry = lastTestOtpsByEmail[normalized];
  return entry ?? null;
}
