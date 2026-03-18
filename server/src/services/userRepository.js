import { execute, queryOne, transaction } from '../db/helpers.js';
import { normalizeEmail } from '../db/helpers.js';
import { toIsoTime } from '../db/helpers.js';

/**
 * Create or update user. Creates if first time, updates profile if changed.
 * @param {object} params
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.email
 * @param {string} params.companyName
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {{ userId: number; created: boolean }}
 */
export function upsertUser({ firstName, lastName, email, companyName, db }) {
  const normalized = normalizeEmail(email);
  const now = toIsoTime(new Date());
  const name = `${firstName.trim()} ${lastName.trim()}`;

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [normalized], db);

  if (existing) {
    execute(
      'UPDATE users SET name = ?, first_name = ?, last_name = ?, company_name = ?, updated_at = ? WHERE email = ?',
      [name, firstName.trim(), lastName.trim(), (companyName ?? '').trim(), now, normalized],
      db
    );
    return { userId: existing.id, created: false };
  }

  const result = execute(
    'INSERT INTO users (name, first_name, last_name, email, company_name) VALUES (?, ?, ?, ?, ?)',
    [name, firstName.trim(), lastName.trim(), normalized, (companyName ?? '').trim()],
    db
  );
  return { userId: result.lastInsertRowid, created: true };
}

/**
 * Get user by email.
 * @param {object} params
 * @param {string} params.email
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {object|undefined}
 */
export function getUserByEmail({ email, db }) {
  const normalized = normalizeEmail(email);
  return queryOne(
    'SELECT id, name, first_name, last_name, email, company_name, nda_accepted_at, nda_version, walkthrough_seen_at FROM users WHERE email = ?',
    [normalized],
    db
  );
}

/**
 * Get user by id.
 * @param {object} params
 * @param {number} params.userId
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {object|undefined}
 */
export function getUserById({ userId, db }) {
  return queryOne(
    'SELECT id, name, first_name, last_name, email, company_name, nda_accepted_at, nda_version, walkthrough_seen_at FROM users WHERE id = ?',
    [userId],
    db
  );
}

/**
 * Update user's last_login_at.
 * @param {object} params
 * @param {number} params.userId
 * @param {import('better-sqlite3').Database} [params.db]
 */
export function updateLastLogin({ userId, db }) {
  const now = toIsoTime(new Date());
  execute('UPDATE users SET last_login_at = ? WHERE id = ?', [now, userId], db);
}

/**
 * Accept NDA for user. Sets nda_accepted_at and nda_version.
 * If already accepted with same version, no update. If different version, updates.
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.ndaVersion
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {object} Updated user row
 */
export function acceptNda({ userId, ndaVersion, db }) {
  const now = toIsoTime(new Date());
  const user = queryOne(
    'SELECT nda_accepted_at, nda_version FROM users WHERE id = ?',
    [userId],
    db
  );

  if (user?.nda_accepted_at && user?.nda_version === ndaVersion) {
    return getUserById({ userId, db });
  }

  execute(
    'UPDATE users SET nda_accepted_at = ?, nda_version = ?, updated_at = ? WHERE id = ?',
    [now, ndaVersion, now, userId],
    db
  );

  return getUserById({ userId, db });
}

/**
 * Complete walkthrough for user. Sets walkthrough_seen_at if not already set.
 * Idempotent: repeated calls succeed without error.
 * @param {object} params
 * @param {number} params.userId
 * @param {import('better-sqlite3').Database} [params.db]
 * @returns {object} Updated user row
 */
export function completeWalkthrough({ userId, db }) {
  const now = toIsoTime(new Date());
  const user = queryOne('SELECT walkthrough_seen_at FROM users WHERE id = ?', [userId], db);

  if (user?.walkthrough_seen_at) {
    return getUserById({ userId, db });
  }

  execute(
    'UPDATE users SET walkthrough_seen_at = ?, updated_at = ? WHERE id = ?',
    [now, now, userId],
    db
  );

  return getUserById({ userId, db });
}
