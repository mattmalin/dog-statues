ALTER TABLE dog_statues.statues ADD
  sources NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  sculptor NVARCHAR(300) NOT NULL DEFAULT '',
  unveiling NVARCHAR(300) NOT NULL DEFAULT '',
  plaque NVARCHAR(MAX) NOT NULL DEFAULT '',
  published_snapshot NVARCHAR(MAX) NULL;

EXEC(N'UPDATE s SET published_snapshot = (
  SELECT
    JSON_QUERY((SELECT s.slug, s.title, s.short_summary, s.web_description, s.address,
      s.city, s.region, s.country, s.postal_code, s.google_maps_url,
      s.latitude, s.longitude, s.cover_media_id
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)) AS statue,
    JSON_QUERY((SELECT LOWER(CONVERT(VARCHAR(36),m.id)) AS id, m.alt_text, m.credit, m.width, m.height
      FROM dog_statues.media_assets m WHERE m.statue_id=s.id AND m.rights_status=''approved''
      ORDER BY m.position,m.id FOR JSON PATH)) AS photos
  FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
) FROM dog_statues.statues s WHERE web_status=''published'';');
