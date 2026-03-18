/**
 * Centralized response formatters for consistent API shapes.
 */

/**
 * User summary (auth/me, accept-nda, complete-walkthrough, verify-otp).
 * @param {object} user - DB user row
 * @returns {object}
 */
export function formatUser(user) {
  const name = user.first_name != null && user.last_name != null
    ? `${user.first_name} ${user.last_name}`.trim()
    : user.name ?? '';
  return {
    id: user.id,
    name,
    firstName: user.first_name ?? user.name?.split(' ')[0] ?? '',
    lastName: user.last_name ?? user.name?.split(' ').slice(1).join(' ') ?? '',
    email: user.email,
    companyName: user.company_name ?? '',
    ndaAccepted: !!user.nda_accepted_at,
    ndaAcceptedAt: user.nda_accepted_at ?? null,
    ndaVersion: user.nda_version ?? null,
    walkthroughSeen: !!user.walkthrough_seen_at,
    walkthroughSeenAt: user.walkthrough_seen_at ?? null,
  };
}

/**
 * Success response with message.
 * @param {string} message
 * @returns {object}
 */
export function successMessage(message) {
  return { success: true, message };
}

/**
 * Error response shape.
 * @param {string} message
 * @param {object} [extra]
 * @returns {object}
 */
export function errorResponse(message, extra = {}) {
  return { error: message, ...extra };
}
