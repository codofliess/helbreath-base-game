import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const supportId = (process.env.DISCORD_SUPPORT_CHANNEL_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)[0];

if (!token || !supportId) {
  console.error('missing token or support id');
  process.exit(1);
}

const body = [
  '**Update:** use slash **`/faq`** (live).',
  'Examples: `/faq question: como juego?` · `/faq question: mint` · `/faq question: AFK`',
  'Free-text in #support needs **Message Content Intent** in Developer Portal → Bot, then `DISCORD_MESSAGE_CONTENT=1` + restart.',
  'DMs to the bot also work.',
].join('\n');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', async () => {
  try {
    const ch = await client.channels.fetch(supportId);
    await ch.send({ content: body });
    console.log('posted /faq tip');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);
