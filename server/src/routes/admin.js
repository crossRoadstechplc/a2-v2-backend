import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  getAccessLogsHandler,
  getUsersAccessSummaryHandler,
  getActiveSessionsHandler,
} from '../controllers/admin.js';

export const adminRouter = Router();

adminRouter.get('/check', requireAuth, requireAdmin, (_req, res) => {
  res.status(200).json({ success: true, message: 'Admin access granted.' });
});

adminRouter.get('/access-logs', requireAuth, requireAdmin, getAccessLogsHandler);
adminRouter.get('/users/access-summary', requireAuth, requireAdmin, getUsersAccessSummaryHandler);
adminRouter.get('/active-sessions', requireAuth, requireAdmin, getActiveSessionsHandler);
