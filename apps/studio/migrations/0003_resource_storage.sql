-- One-time data migration. Application code only reads the normalized tables below.
CREATE TABLE workspace (
  id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, mutation_id TEXT NOT NULL
);
INSERT INTO workspace SELECT id,revision,updated_at,updated_by,'migration' FROM content;
CREATE TABLE content_resources (
  key TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT,
  CHECK(document IS NULL OR length(CAST(document AS BLOB)) <= 1800000)
);
CREATE TABLE resource_versions (
  key TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT,
  PRIMARY KEY(key,revision),
  CHECK(document IS NULL OR length(CAST(document AS BLOB)) <= 1800000)
);
CREATE INDEX resource_versions_revision ON resource_versions(revision);
INSERT INTO content_resources SELECT 'page:' || json_extract(p.value,'$.id'), c.revision,p.value
  FROM content c,json_each(c.document,'$.pages') p;
INSERT INTO content_resources SELECT 'settings',revision,json_extract(document,'$.settings') FROM content;
INSERT INTO content_resources SELECT 'news',revision,json_extract(document,'$.news') FROM content;
INSERT INTO content_resources SELECT 'medium',revision,json_extract(document,'$.medium') FROM content;
INSERT INTO content_resources SELECT 'pageOrder',revision,
  (SELECT json_group_array(json_extract(value,'$.id')) FROM json_each(content.document,'$.pages')) FROM content;
INSERT INTO resource_versions SELECT 'page:' || json_extract(p.value,'$.id'), r.revision,p.value
  FROM revisions r,json_each(r.document,'$.pages') p;
INSERT INTO resource_versions SELECT 'settings',revision,json_extract(document,'$.settings') FROM revisions;
INSERT INTO resource_versions SELECT 'news',revision,json_extract(document,'$.news') FROM revisions;
INSERT INTO resource_versions SELECT 'medium',revision,json_extract(document,'$.medium') FROM revisions;
INSERT INTO resource_versions SELECT 'pageOrder',revision,
  (SELECT json_group_array(json_extract(value,'$.id')) FROM json_each(revisions.document,'$.pages')) FROM revisions;
-- Keep tombstones so deleting and recreating an ID cannot defeat optimistic concurrency.
INSERT OR IGNORE INTO content_resources SELECT DISTINCT key,(SELECT revision FROM workspace),NULL FROM resource_versions;
ALTER TABLE revisions RENAME TO snapshot_revisions;
CREATE TABLE revisions (
  revision INTEGER PRIMARY KEY, created_at TEXT NOT NULL, created_by TEXT NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL
);
INSERT INTO revisions SELECT revision,created_at,created_by,'migration-' || revision,'' FROM snapshot_revisions;
DROP TABLE snapshot_revisions;
DROP TABLE content;
