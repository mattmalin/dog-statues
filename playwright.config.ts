import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4177',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'Android viewport', use: { ...devices['Pixel 7'] } },
    { name: 'Desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177/healthz',
    timeout: 60_000,
    env: {
      AUTH_MODE: 'local',
      LOCAL_ADMIN_PASSWORD: 'test-fixture-passphrase-only',
      ATLAS_DATA_DIR: 'test-results/atlas-data',
      DATABASE_URL: '',
      AZURE_STORAGE_CONNECTION_STRING: '',
      AZURE_STORAGE_ACCOUNT_URL: '',
    },
  },
});
