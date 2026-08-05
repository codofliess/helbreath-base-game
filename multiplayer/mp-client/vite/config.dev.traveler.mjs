import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')

/**
 * Second Vite instance for the real-player (traveler) flow on port 8081.
 * Does not kill or replace the GM client on 8080.
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
    return {
        base: './',
        plugins: [
            react(),
        ],
        resolve: {
            alias: {
                '@sp-client': path.resolve(repoRoot, 'sp-client/src'),
            },
        },
        define: {
            'import.meta.env.VITE_PLAYER_MODE': JSON.stringify(
                env.VITE_PLAYER_MODE || 'traveler',
            ),
        },
        server: {
            port: 8081,
            strictPort: true,
            fs: {
                allow: [repoRoot],
            },
        },
    }
})
