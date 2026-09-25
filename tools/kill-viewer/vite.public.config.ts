import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PUBLIC viewer bundle. Must never import from src/server/admin, src/shared/private-*.
export default defineConfig({
  root: 'web/public',
  plugins: [react()],
  build: { outDir: '../../dist/public', emptyOutDir: true, sourcemap: false },
  // '^/api/' is a regex (Vite treats keys starting with ^ as RegExp). A prefix of '/api'
  // also matches the client module /api.ts and /apiClient.ts and blanks the dev app.
  server: { port: 5173, proxy: { '^/api/': 'http://127.0.0.1:8787' } },
});
