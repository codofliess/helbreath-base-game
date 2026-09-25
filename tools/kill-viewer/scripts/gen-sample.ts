/**
 * Optional local writer for SAMPLE / MOCK data. Output is gitignored — do not commit fixtures.
 * Tests generate the same data in memory via generatePublicSample().
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { generatePublicSample } from '../src/shared/sample-public';
import { generateSampleLocations } from '../src/server/admin/sample-locations';

const data = generatePublicSample();
const { drafts: _drafts, ...publicSlice } = data;
const locs = generateSampleLocations(data);
mkdirSync('sample/public', { recursive: true }); mkdirSync('sample/private', { recursive: true });
writeFileSync('sample/public/kills.sample.json', JSON.stringify(publicSlice));
writeFileSync('sample/private/kill_location.sample.json', JSON.stringify({
  _notice: data._notice + ' PRIVATE SLICE — admin API only.',
  kill_location: locs,
}));
console.log(`wrote ${data.kills.length} kills, ${locs.length} locations (gitignored)`);
