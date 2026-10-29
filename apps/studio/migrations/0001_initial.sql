CREATE TABLE content (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  revision INTEGER NOT NULL,
  document TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE TABLE revisions (
  revision INTEGER PRIMARY KEY,
  document TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE TABLE releases (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  base_id TEXT,
  content_revision INTEGER NOT NULL,
  source_commit TEXT NOT NULL,
  status TEXT NOT NULL,
  snapshot_hash TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  error TEXT,
  run_id TEXT,
  artifact_hash TEXT
);
CREATE TABLE site_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  active_id TEXT,
  publishing_id TEXT
);
INSERT INTO site_state(id) VALUES (1);
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE feed_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  checked_at TEXT,
  succeeded_at TEXT,
  error TEXT,
  entries TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO feed_state(id) VALUES (1);
CREATE TABLE reward_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  remaining INTEGER NOT NULL DEFAULT 0 CHECK(remaining >= 0),
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO reward_state(id) VALUES (1);
CREATE TABLE reward_requests (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  reference TEXT,
  created_at TEXT NOT NULL
);
