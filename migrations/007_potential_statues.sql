CREATE TABLE dog_statues.potential_statues (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  name NVARCHAR(160) NOT NULL,
  city NVARCHAR(100) NOT NULL DEFAULT '',
  country NVARCHAR(100) NOT NULL DEFAULT '',
  location NVARCHAR(320) NOT NULL DEFAULT '',
  maps_url NVARCHAR(2048) NOT NULL DEFAULT '',
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  pin_checked BIT NOT NULL DEFAULT 0,
  source_url NVARCHAR(2048) NOT NULL DEFAULT '',
  notes NVARCHAR(MAX) NOT NULL DEFAULT '',
  status VARCHAR(12) NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching', 'to_visit', 'visited', 'archived')),
  revision INT NOT NULL DEFAULT 0,
  created_at VARCHAR(24) NOT NULL,
  updated_at VARCHAR(24) NOT NULL,
  CHECK ((latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
IF DATABASE_PRINCIPAL_ID(N'dogatlas-runtime') IS NOT NULL
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dog_statues.potential_statues TO [dogatlas-runtime];
