import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// STAFF-ONLY admin bundle. Served only by the admin API host (separate port/host).
export default defineConfig({
  root: 'web/admin',
  base: '/admin/',
  plugins: [react()],
  build: { outDir: '../../dist/admin', emptyOutDir: true, sourcemap: false },
  server: { port: 5174, proxy: { '/admin/api': 'http://127.0.0.1:8788' } },
});
