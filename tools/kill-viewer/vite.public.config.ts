import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PUBLIC viewer bundle. Must never import from src/server/admin, src/shared/private-*.
export default defineConfig({
  root: 'web/public',
  plugins: [react()],
  build: { outDir: '../../dist/public', emptyOutDir: true, sourcemap: false },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } },
});
