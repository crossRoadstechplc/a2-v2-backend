-- Session finalization: logout_at, session_seconds, total_session_seconds

ALTER TABLE access_logs ADD COLUMN logout_at TEXT;
ALTER TABLE access_logs ADD COLUMN session_seconds INTEGER;

ALTER TABLE users ADD COLUMN total_session_seconds INTEGER NOT NULL DEFAULT 0;
