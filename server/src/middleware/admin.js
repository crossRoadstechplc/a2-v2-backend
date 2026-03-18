/**
 * Admin authorization middleware.
 * Must run after requireAuth. Requires valid session and users.is_admin = 1.
 * Returns 401 if unauthenticated, 403 if authenticated but not admin.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const isAdmin = req.user.is_admin === 1 || req.user.is_admin === true;
  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  next();
}
