CREATE TABLE statues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  short_summary TEXT NOT NULL DEFAULT '',
  web_description TEXT NOT NULL DEFAULT '',
  instagram_caption TEXT NOT NULL DEFAULT '',
  private_notes TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  latitude REAL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude BETWEEN -180 AND 180),
  editorial_status TEXT NOT NULL DEFAULT 'inbox' CHECK (editorial_status IN ('inbox', 'draft', 'ready')),
  visit_status TEXT NOT NULL DEFAULT 'unvisited' CHECK (visit_status IN ('visited', 'unvisited')),
  web_status TEXT NOT NULL DEFAULT 'unpublished' CHECK (web_status IN ('unpublished', 'published', 'hidden')),
  slug TEXT UNIQUE,
  web_published_at TEXT,
  cover_media_id TEXT,
  photo_waiver INTEGER NOT NULL DEFAULT 0 CHECK (photo_waiver IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX statues_status_updated ON statues (web_status, updated_at);
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  statue_id TEXT NOT NULL REFERENCES statues(id),
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  position INTEGER NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  credit TEXT NOT NULL DEFAULT '',
  rights_status TEXT NOT NULL DEFAULT 'private' CHECK (rights_status IN ('private', 'approved')),
  created_at TEXT NOT NULL
);
CREATE INDEX media_statue_order ON media_assets (statue_id, position);
