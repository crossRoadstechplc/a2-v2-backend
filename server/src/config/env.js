import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevOrTest: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  databasePath: process.env.DATABASE_PATH ?? './data/a2-gateway.db',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  otpRequestLimit: parseInt(process.env.OTP_REQUEST_LIMIT ?? '5', 10),
  mailTestMode: process.env.MAIL_TEST_MODE === 'true',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'noreply@example.com',
  },
};
