/**
 * Access log status values.
 * Transitions: active → logged_out | expired (finalization is one-way, idempotent).
 */
export const ACCESS_LOG_STATUS = Object.freeze({
  ACTIVE: 'active',
  LOGGED_OUT: 'logged_out',
  EXPIRED: 'expired',
});
