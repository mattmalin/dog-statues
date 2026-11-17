IF SCHEMA_ID(N'dog_statues') IS NULL
  EXEC(N'CREATE SCHEMA dog_statues AUTHORIZATION dbo');

ALTER SCHEMA dog_statues TRANSFER dbo.statues;
ALTER SCHEMA dog_statues TRANSFER dbo.media_assets;
ALTER SCHEMA dog_statues TRANSFER dbo.instagram_publications;
ALTER SCHEMA dog_statues TRANSFER dbo.atlas_migrations;

IF DATABASE_PRINCIPAL_ID(N'dogatlas-runtime') IS NOT NULL
BEGIN
  ALTER USER [dogatlas-runtime] WITH DEFAULT_SCHEMA = dog_statues;
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dog_statues.statues TO [dogatlas-runtime];
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dog_statues.media_assets TO [dogatlas-runtime];
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dog_statues.instagram_publications TO [dogatlas-runtime];
END;
