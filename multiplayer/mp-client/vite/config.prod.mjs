import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const mpClientRoot = path.resolve(__dirname, '..');

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = '---------------------------------------------------------';
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            process.stdout.write(`✨ Done ✨\n`);
        },
    };
};

export default defineConfig({
    base: './',
    plugins: [react(), phasermsg()],
    // Public traveler client is the production default. Override with VITE_PLAYER_MODE=gm only for sandbox builds.
    define: {
        'import.meta.env.VITE_PLAYER_MODE': JSON.stringify(
            process.env.VITE_PLAYER_MODE || 'traveler',
        ),
        'import.meta.env.VITE_MIDDLEWARE_URL': JSON.stringify(
            process.env.VITE_MIDDLEWARE_URL ||
                'https://chainlords-middleware-production.up.railway.app',
        ),
        // Live Hetzner client must not bake in full-world minimap capture (Chrome OOM).
        // Snapshot tooling: VITE_GENERATE_MINIMAP=1 pnpm build
        'import.meta.env.VITE_GENERATE_MINIMAP': JSON.stringify(
            process.env.VITE_GENERATE_MINIMAP || '',
        ),
    },
    resolve: {
        alias: {
            '@sp-client': path.resolve(repoRoot, 'sp-client/src'),
            // When bundling shared sp-client modules, resolve phaser from mp-client.
            phaser: path.resolve(mpClientRoot, 'node_modules/phaser'),
        },
        dedupe: ['phaser', 'react', 'react-dom'],
    },
    logLevel: 'warning',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                },
            },
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2,
            },
            mangle: true,
            format: {
                comments: false,
            },
        },
    },
});
