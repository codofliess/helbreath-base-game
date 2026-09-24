import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Isolated playtest traveler on 127.0.0.1:8081.
 * Game is 127.0.0.1:31337. Polling avoids EMFILE on tight watcher limits.
 */
export default defineConfig({
    base: './',
    plugins: [react()],
    define: {
        'import.meta.env.VITE_PLAYER_MODE': JSON.stringify('traveler'),
        'import.meta.env.VITE_PLAYTEST': JSON.stringify('1'),
        'import.meta.env.VITE_MIDDLEWARE_URL': JSON.stringify(''),
        'import.meta.env.VITE_GAME_HOST': JSON.stringify('127.0.0.1'),
        'import.meta.env.VITE_GAME_PORT': JSON.stringify('31337'),
    },
    server: {
        port: 8081,
        strictPort: true,
        host: '127.0.0.1',
        watch: {
            usePolling: true,
            interval: 1000,
        },
    },
})
