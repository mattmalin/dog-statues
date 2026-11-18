CREATE TABLE video_assets (
  id TEXT PRIMARY KEY,
  statue_id TEXT NOT NULL REFERENCES statues(id),
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  duration_seconds REAL NOT NULL,
  position INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  credit TEXT NOT NULL DEFAULT '',
  captions TEXT NOT NULL DEFAULT '',
  rights_status TEXT NOT NULL DEFAULT 'private' CHECK (rights_status IN ('private','approved')),
  created_at TEXT NOT NULL
);
CREATE INDEX video_statue_order ON video_assets (statue_id, position);
