import { readFile, readdir } from 'node:fs/promises';
import sql from 'mssql';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL for the SQL Server migration target.');
const pool = await new sql.ConnectionPool(url).connect();
try {
  const folder = new URL('../migrations/', import.meta.url);
  const files = (await readdir(folder)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction.request().batch(`
      DECLARE @result int;
      EXEC @result = sp_getapplock @Resource='DogStatueAtlasMigrations', @LockMode='Exclusive',
        @LockOwner='Transaction', @LockTimeout=10000;
      IF @result < 0 THROW 50001, 'Migration lock unavailable.', 1;
      IF OBJECT_ID('dbo.atlas_migrations','U') IS NULL
        CREATE TABLE dbo.atlas_migrations (filename NVARCHAR(160) PRIMARY KEY, applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
    `);
    for (const file of files) {
      const request = () => transaction.request().input('filename', sql.NVarChar(160), file);
      if (
        (
          await request().query(
            'SELECT filename FROM dbo.atlas_migrations WHERE filename=@filename',
          )
        ).recordset.length
      )
        continue;
      await transaction.request().batch(await readFile(new URL(file, folder), 'utf8'));
      await request().query('INSERT INTO dbo.atlas_migrations (filename) VALUES (@filename)');
      console.log('Applied ' + file);
    }
    await transaction.commit();
  } catch (cause) {
    await transaction.rollback().catch(() => {});
    throw cause;
  }
} finally {
  await pool.close();
}
