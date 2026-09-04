import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { helbreathPlaytestAssetsPlugin } from './helbreathPlaytestAssetsPlugin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const mpClientRoot = path.resolve(__dirname, '..')

/**
 * Isolated playtest traveler on :8081 (PLAYTEST=1). Not the live host.
 * Do not set VITE_GAME_HOST to play.chainlords.net.
 */
export default defineConfig({
    base: './',
    plugins: [react(), helbreathPlaytestAssetsPlugin(mpClientRoot)],
    resolve: {
        alias: {
            '@sp-client': path.resolve(repoRoot, 'sp-client/src'),
        },
    },
    define: {
        'import.meta.env.VITE_PLAYER_MODE': JSON.stringify('traveler'),
        'import.meta.env.VITE_PLAYTEST': JSON.stringify('1'),
        'import.meta.env.VITE_MIDDLEWARE_URL': JSON.stringify(''),
    },
    server: {
        port: 8081,
        strictPort: true,
        host: '127.0.0.1',
        fs: {
            allow: [repoRoot],
        },
    },
})
