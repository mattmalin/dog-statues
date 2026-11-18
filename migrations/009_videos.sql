CREATE TABLE dog_statues.video_assets (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  statue_id UNIQUEIDENTIFIER NOT NULL REFERENCES dog_statues.statues(id),
  original_filename NVARCHAR(220) NOT NULL,
  mime_type NVARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  duration_seconds FLOAT NOT NULL,
  position INT NOT NULL,
  description NVARCHAR(1000) NOT NULL DEFAULT N'',
  credit NVARCHAR(300) NOT NULL DEFAULT N'',
  captions NVARCHAR(MAX) NOT NULL DEFAULT N'',
  rights_status NVARCHAR(20) NOT NULL DEFAULT N'private' CHECK (rights_status IN ('private','approved')),
  created_at VARCHAR(24) NOT NULL
);
CREATE INDEX video_statue_order ON dog_statues.video_assets (statue_id, position);
IF DATABASE_PRINCIPAL_ID('dogatlas-runtime') IS NOT NULL
  GRANT SELECT, INSERT, UPDATE, DELETE ON dog_statues.video_assets TO [dogatlas-runtime];
