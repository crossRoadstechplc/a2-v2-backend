-- Login analytics: login_count, last_seen_at, last_activity_at, access_logs

ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_seen_at TEXT;

ALTER TABLE sessions ADD COLUMN last_activity_at TEXT;

CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  login_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_session_id ON access_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_login_at ON access_logs(login_at);
