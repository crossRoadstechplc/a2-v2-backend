-- Admin role: users.is_admin (1 = admin, 0 = regular user)

ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
