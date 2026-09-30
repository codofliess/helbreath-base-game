#!/usr/bin/env node
/**
 * Rename a character through the running game server.
 *
 * The server updates, together:
 *   - the characters row (name column and state_json.CharacterName)
 *   - Chars/<wallet>.json and <wallet>.traveler.json when they use the old name
 *   - the live session and in-world avatar when that character is online
 *
 * This script does not open Postgres and does not write save files itself.
 *
 * Usage:
 *   GAME_SERVER_URL=http://127.0.0.1:5000 \
 *   ADMIN_API_KEY=... \
 *   node scripts/rename-character.mjs <wallet> <currentName> <newName>
 *
 * ADMIN_SECRET is accepted when ADMIN_API_KEY is unset.
 */

const base = (process.env.GAME_SERVER_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const key = (process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET || '').trim();
const [wallet, currentName, newName] = process.argv.slice(2);

if (!key || !wallet || !currentName || !newName) {
    console.error('Usage: ADMIN_API_KEY=... node scripts/rename-character.mjs <wallet> <currentName> <newName>');
    console.error('Also set GAME_SERVER_URL (default http://127.0.0.1:5000).');
    process.exit(1);
}

const response = await fetch(`${base}/api/admin/characters/rename`, {
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        'x-admin-key': key,
    },
    body: JSON.stringify({ wallet, currentName, newName }),
});

const text = await response.text();
let body = text;
try {
    body = JSON.parse(text);
} catch {
    // Keep the raw body when the server did not return JSON.
}

console.log(JSON.stringify({ status: response.status, body }, null, 2));
process.exit(response.ok ? 0 : 1);
