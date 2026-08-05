import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
    ],
    resolve: {
        alias: {
            '@sp-client': path.resolve(repoRoot, 'sp-client/src'),
        },
    },
    server: {
        port: 8080,
        fs: {
            allow: [repoRoot],
        },
    },
})
