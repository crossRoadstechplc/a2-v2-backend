import { config } from '../config/env.js';

/**
 * Central error handler middleware.
 * Sends appropriate JSON response and hides stack in production.
 */
export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? 'Internal Server Error';

  const payload = {
    success: false,
    error: message,
    ...(config.isDevOrTest && err.stack && { stack: err.stack }),
  };

  res.status(status).json(payload);
}
