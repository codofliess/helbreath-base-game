import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Local GM client on 127.0.0.1:8080 against the PLAYTEST game on :31337.
 * Same seat bypass as the traveler. Editor dialogs stay available.
 */
export default defineConfig({
    base: './',
    plugins: [react()],
    define: {
        'import.meta.env.VITE_PLAYER_MODE': JSON.stringify('gm'),
        'import.meta.env.VITE_PLAYTEST': JSON.stringify('1'),
        'import.meta.env.VITE_MIDDLEWARE_URL': JSON.stringify(''),
        'import.meta.env.VITE_GAME_HOST': JSON.stringify('127.0.0.1'),
        'import.meta.env.VITE_GAME_PORT': JSON.stringify('31337'),
    },
    server: {
        port: 8080,
        strictPort: true,
        host: '127.0.0.1',
        watch: {
            usePolling: true,
            interval: 1000,
        },
    },
})
