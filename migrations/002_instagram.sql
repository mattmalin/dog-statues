CREATE TABLE instagram_publications (
  statue_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY REFERENCES statues(id),
  attempt_id UNIQUEIDENTIFIER NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('preparing', 'failed', 'unknown', 'published')),
  payload NVARCHAR(MAX) NOT NULL,
  container_id VARCHAR(64) NULL,
  post_id VARCHAR(64) NULL,
  permalink NVARCHAR(512) NULL,
  updated_at VARCHAR(24) NOT NULL
);
