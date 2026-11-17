CREATE TABLE potential_statues (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  maps_url TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  pin_checked INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching', 'to_visit', 'visited', 'archived')),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
