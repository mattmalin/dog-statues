CREATE TABLE instagram_publications (
  statue_id TEXT NOT NULL PRIMARY KEY REFERENCES statues(id),
  attempt_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preparing', 'failed', 'unknown', 'published')),
  payload TEXT NOT NULL,
  container_id TEXT,
  post_id TEXT,
  permalink TEXT,
  updated_at TEXT NOT NULL
);
