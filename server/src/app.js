import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { testRouter } from './routes/test.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security
app.use(helmet());

// CORS
app.use(cors());

// Cookie parsing (for session IDs)
app.use(cookieParser());

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Body parsing
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);

if (config.isDevOrTest) {
  app.use('/test', testRouter);
}

// Root redirect or info
app.get('/', (_req, res) => {
  res.redirect('/health');
});

// 404 handler
app.use((_req, _res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
