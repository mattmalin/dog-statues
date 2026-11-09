import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, normalizePath } from 'vite';

export default defineConfig(({ mode }) => {
  const { ATLAS_DATA_DIR } = loadEnv(mode, process.cwd(), 'ATLAS_');
  const dataPath = normalizePath(resolve(ATLAS_DATA_DIR || '.atlas'));
  const literal = dataPath.replace(/[\[\]{}()*?+!@]/g, '\\$&');
  return {
    plugins: [sveltekit()],
    server: {
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', literal + '/**', '**/.atlas/**'],
      },
    },
  };
});
