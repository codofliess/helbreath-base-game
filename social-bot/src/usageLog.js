/**
 * Append-only xAI usage lines for later model-routing reports.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(__dirname, '..', 'data', 'xai-usage.jsonl');

export function logXaiUsage(entry) {
  try {
    const file = process.env.XAI_USAGE_LOG || defaultPath;
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    });
    fs.appendFileSync(file, `${line}\n`, 'utf8');
  } catch (e) {
    console.warn('[xai-usage]', e.message);
  }
}
