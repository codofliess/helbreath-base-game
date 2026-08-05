/**
 * Local JSON queue for X + Discord content drafts (staff workflow).
 * Posting to X is copy-ready unless X_API is configured later.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const queuePath = path.join(dataDir, 'content-queue.json');

function ensure() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(queuePath)) {
    fs.writeFileSync(queuePath, JSON.stringify({ drafts: [] }, null, 2));
  }
}

function load() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  } catch {
    return { drafts: [] };
  }
}

function save(state) {
  ensure();
  fs.writeFileSync(queuePath, JSON.stringify(state, null, 2));
}

function nextId(drafts) {
  const n = drafts.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0);
  return String(n + 1);
}

/**
 * @param {{ platform: 'x'|'discord'|'both', title: string, body: string, authorTag: string }} input
 */
export function addDraft(input) {
  const state = load();
  const draft = {
    id: nextId(state.drafts),
    platform: input.platform || 'both',
    title: (input.title || '').slice(0, 120),
    body: (input.body || '').slice(0, 1800),
    authorTag: input.authorTag || 'staff',
    status: 'draft',
    createdAt: new Date().toISOString(),
    postedAt: null,
  };
  state.drafts.unshift(draft);
  // Keep last 100
  state.drafts = state.drafts.slice(0, 100);
  save(state);
  return draft;
}

export function listDrafts(limit = 10) {
  const state = load();
  return state.drafts.slice(0, limit);
}

export function getDraft(id) {
  const state = load();
  return state.drafts.find((d) => d.id === String(id)) || null;
}

export function markPosted(id, where) {
  const state = load();
  const d = state.drafts.find((x) => x.id === String(id));
  if (!d) return null;
  d.status = 'posted';
  d.postedAt = new Date().toISOString();
  d.postedWhere = where;
  save(state);
  return d;
}

export function formatForX(body) {
  // X free post ~280; allow long form note if longer
  const t = body.trim();
  if (t.length <= 280) return t;
  return `${t.slice(0, 277)}…`;
}

export function formatDraftCard(d) {
  return [
    `**#${d.id}** · \`${d.platform}\` · *${d.status}* · ${d.authorTag}`,
    d.title ? `**${d.title}**` : '',
    '```',
    d.body.slice(0, 900),
    '```',
    d.createdAt,
  ]
    .filter(Boolean)
    .join('\n');
}
