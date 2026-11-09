import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export const config = {
  localAuth: dev && process.env.NODE_ENV !== 'production' && env.AUTH_MODE === 'local',
  entraAuth: !dev && env.AUTH_MODE === 'entra' && Boolean(env.CONTAINER_APP_NAME),
  localPassword: env.LOCAL_ADMIN_PASSWORD ?? '',
  tenant: env.ENTRA_TENANT_ID ?? '',
  owner: env.ENTRA_ADMIN_OBJECT_ID ?? '',
  dataDir: env.ATLAS_DATA_DIR || '.atlas',
  sql: env.DATABASE_URL,
  blobConnection: env.AZURE_STORAGE_CONNECTION_STRING,
  blobAccount: env.AZURE_STORAGE_ACCOUNT_URL,
  blobContainer: env.AZURE_STORAGE_CONTAINER || 'atlas',
};

if (config.entraAuth && (!config.sql || !config.blobAccount || config.blobConnection)) {
  throw new Error(
    'Entra mode requires SQL Server and an Azure Blob account with managed identity.',
  );
}
