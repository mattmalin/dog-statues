CREATE TABLE statues (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  title NVARCHAR(160) NOT NULL DEFAULT '',
  short_summary NVARCHAR(300) NOT NULL DEFAULT '',
  web_description NVARCHAR(MAX) NOT NULL DEFAULT '',
  instagram_caption NVARCHAR(2200) NOT NULL DEFAULT '',
  private_notes NVARCHAR(MAX) NOT NULL DEFAULT '',
  address NVARCHAR(320) NOT NULL DEFAULT '',
  city NVARCHAR(100) NOT NULL DEFAULT '',
  region NVARCHAR(100) NOT NULL DEFAULT '',
  country NVARCHAR(100) NOT NULL DEFAULT '',
  postal_code NVARCHAR(30) NOT NULL DEFAULT '',
  latitude DECIMAL(9,6) NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DECIMAL(9,6) NULL CHECK (longitude BETWEEN -180 AND 180),
  editorial_status VARCHAR(12) NOT NULL DEFAULT 'inbox' CHECK (editorial_status IN ('inbox', 'draft', 'ready')),
  visit_status VARCHAR(12) NOT NULL DEFAULT 'unvisited' CHECK (visit_status IN ('visited', 'unvisited')),
  web_status VARCHAR(12) NOT NULL DEFAULT 'unpublished' CHECK (web_status IN ('unpublished', 'published', 'hidden')),
  slug VARCHAR(200) NULL,
  web_published_at VARCHAR(24) NULL,
  cover_media_id UNIQUEIDENTIFIER NULL,
  photo_waiver BIT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 0,
  created_at VARCHAR(24) NOT NULL,
  updated_at VARCHAR(24) NOT NULL
);
CREATE UNIQUE INDEX statues_slug ON statues (slug) WHERE slug IS NOT NULL;
CREATE INDEX statues_status_updated ON statues (web_status, updated_at);
CREATE TABLE media_assets (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  statue_id UNIQUEIDENTIFIER NOT NULL REFERENCES statues(id),
  original_filename NVARCHAR(240) NOT NULL,
  mime_type VARCHAR(40) NOT NULL,
  size_bytes INT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  position INT NOT NULL,
  alt_text NVARCHAR(500) NOT NULL DEFAULT '',
  credit NVARCHAR(300) NOT NULL DEFAULT '',
  rights_status VARCHAR(12) NOT NULL DEFAULT 'private' CHECK (rights_status IN ('private', 'approved')),
  created_at VARCHAR(24) NOT NULL
);
CREATE INDEX media_statue_order ON media_assets (statue_id, position);
