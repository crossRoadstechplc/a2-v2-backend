import { getAccessLogs, getUsersAccessSummary, getActiveSessions } from '../services/adminAnalyticsService.js';

/**
 * GET /admin/access-logs
 * Admin-only. Paginated access logs with user info.
 */
export function getAccessLogsHandler(req, res, next) {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;
    const email = req.query.email;
    const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';
    const dateFrom = req.query.dateFrom || undefined;
    const dateTo = req.query.dateTo || undefined;

    const rows = getAccessLogs({
      limit,
      offset,
      email,
      activeOnly,
      dateFrom,
      dateTo,
    });

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/users/access-summary
 * Admin-only. User-level access summaries.
 */
export function getUsersAccessSummaryHandler(req, res, next) {
  try {
    const rows = getUsersAccessSummary({});
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/active-sessions
 * Admin-only. Active sessions only.
 */
export function getActiveSessionsHandler(req, res, next) {
  try {
    const rows = getActiveSessions({});
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}
