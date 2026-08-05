/**
 * One-shot: post FAQ intro in #support if last bot message is old/missing.
 */
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const supportId = (process.env.DISCORD_SUPPORT_CHANNEL_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)[0];
const site = process.env.OFFICIAL_PLAY_URL || 'https://www.chainlords.net';
const invite = process.env.OFFICIAL_DISCORD_URL || 'https://discord.gg/F4NwwbfKtj';

if (!token || !supportId) {
  console.error('Need DISCORD_BOT_TOKEN + DISCORD_SUPPORT_CHANNEL_IDS');
  process.exit(1);
}

const intro = [
  '**Chain Lords FAQ bot is live** (static mode — Grok optional later).',
  '',
  'Ask in this channel (EN/ES), e.g.:',
  '• `how do I play?` / `como juego?`',
  '• `wallet` / `phantom` / `seed`',
  '• `bug` · `arena` · `mint` · `AFK` · `EK` · `$HELL`',
  '• `scam` / `estafa`',
  '',
  `Site: ${site}`,
  `Invite: ${invite}`,
  '',
  'Staff **never** DMs first for seeds. For bans/refunds/policy → human mod.',
  '_DMs to the bot also work. @mention me in other channels._',
].join('\n');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', async () => {
  try {
    const ch = await client.channels.fetch(supportId);
    if (!ch?.isTextBased()) throw new Error('support not text');
    const recent = await ch.messages.fetch({ limit: 15 });
    const already = recent.find(
      (m) => m.author.id === client.user.id && /FAQ bot is live/i.test(m.content),
    );
    if (already) {
      console.log('Intro already present', already.id);
    } else {
      const msg = await ch.send({ content: intro });
      console.log('Posted intro', msg.id);
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);
