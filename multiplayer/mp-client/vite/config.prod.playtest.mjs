import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { helbreathPlaytestAssetsPlugin } from './helbreathPlaytestAssetsPlugin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const mpClientRoot = path.resolve(__dirname, '..')

/**
 * Static playtest bundle (VITE_PLAYTEST=1). Serve only with a PLAYTEST=1 game server.
 * Output is dist-playtest — never the live traveler dist.
 */
export default defineConfig({
    base: './',
    plugins: [react(), helbreathPlaytestAssetsPlugin(mpClientRoot)],
    define: {
        'import.meta.env.VITE_PLAYER_MODE': JSON.stringify('traveler'),
        'import.meta.env.VITE_PLAYTEST': JSON.stringify('1'),
        'import.meta.env.VITE_MIDDLEWARE_URL': JSON.stringify(''),
    },
    resolve: {
        alias: {
            '@sp-client': path.resolve(repoRoot, 'sp-client/src'),
            phaser: path.resolve(mpClientRoot, 'node_modules/phaser'),
        },
        dedupe: ['phaser', 'react', 'react-dom'],
    },
    logLevel: 'warning',
    build: {
        outDir: 'dist-playtest',
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
})
