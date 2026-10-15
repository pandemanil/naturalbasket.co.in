-- Failed admin logins, used for simple brute-force throttling in D1.
CREATE TABLE login_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_key    TEXT NOT NULL,
  attempted_at  INTEGER NOT NULL         -- unix seconds
);
CREATE INDEX idx_login_attempts_key ON login_attempts(client_key, attempted_at);
