import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const mpClientRoot = path.resolve(__dirname, '..');

function isPhaserPreloadId(id) {
    return /(?:^|\/)phaser[-.]|PhaserGame|gameWorldCanvasPresentation/i.test(id);
}

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        generateBundle(_opts, bundle) {
            for (const [file, chunk] of Object.entries(bundle)) {
                if (chunk.type === 'asset' && file.endsWith('.html')) {
                    const html = String(chunk.source ?? '');
                    if (/modulepreload[^>]+(?:phaser-|PhaserGame|gameWorldCanvasPresentation)/i.test(html)) {
                        throw new Error(
                            `Hub index.html must not modulepreload Phaser (KindGem Error 9 on hub connect). ${file}`,
                        );
                    }
                    continue;
                }
                if (chunk.type !== 'chunk' || !chunk.isEntry) {
                    continue;
                }
                if (!file.includes('index')) {
                    continue;
                }
                const staticPhaser = (chunk.imports ?? []).some((id) => id.includes('phaser'));
                const codeHasPhaser = /from["']\.\/phaser-/.test(chunk.code ?? '');
                const codeHasWorldCanvas = /gameWorldCanvasPresentation/.test(chunk.code ?? '');
                if (staticPhaser || codeHasPhaser || codeHasWorldCanvas) {
                    throw new Error(
                        `Hub index chunk must not load Phaser/WebGL (KindGem Error 9 before connect UI). ${file} imports=${JSON.stringify(chunk.imports)}`,
                    );
                }
            }
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
        // Do not modulepreload PhaserGame / phaser from the hub HTML. Chrome
        // evaluates that graph after Phantom overlay and Aw Snaps Error 9
        // before React Explorer Occupied can paint.
        modulePreload: {
            resolveDependencies(_filename, deps) {
                return deps.filter((dep) => !isPhaserPreloadId(dep));
            },
        },
        rollupOptions: {
            output: {
                // Do NOT put Phaser in manualChunks. That chunk also collects Vite CJS
                // interop helpers, so index-*.js would static-import the whole Phaser
                // bundle on the hub (KindGem Error 9). Phaser must load only via the
                // dynamic StartGame import after seal.
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
