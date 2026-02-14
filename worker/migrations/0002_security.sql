-- Brute-force tracking
ALTER TABLE auth_codes ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_auth_codes_user_id ON auth_codes(user_id);

-- D1-backed rate limiting
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER NOT NULL
);

-- Session-based JWT revocation
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
