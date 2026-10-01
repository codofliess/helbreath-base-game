// Bundles the two API entrypoints into independent artifacts (separately deployable).
import { build } from 'esbuild';
const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', packages: 'external', logLevel: 'info' };
await build({ ...common, entryPoints: ['src/server/public/index.ts'], outfile: 'dist/server/public-api.mjs' });
await build({ ...common, entryPoints: ['src/server/admin/index.ts'], outfile: 'dist/server/admin-api.mjs' });
