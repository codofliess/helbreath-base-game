/**
 * Announce Arena $HELL incentives on X (@ChainLordsHQ) and Discord #announcements + #arena-news.
 * Usage: node _post_arena_incentives.mjs
 */
import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { createPost, getXApiStatus, estimatePostCost } from './src/xApi.js';

const ANNOUNCE_CHANNEL_ID = process.env.DISCORD_ANNOUNCE_CHANNEL_ID?.trim() || '1528994017428377612';
const ARENA_NEWS_CHANNEL_ID = process.env.DISCORD_ARENA_NEWS_CHANNEL_ID?.trim() || '1528994035694309477';

// X allows only ONE cashtag ($SYMBOL) per post.
const xText = [
  'ARENA + stream rewards on Chain Lords',
  '',
  '• AFK 2h on Bleeding Island → 5k/day',
  '• Duel: winner 7k · loser 3k (1 paid duel per rival/day)',
  '• Live on X ≥15m, link on the cartelera → 50k that day',
  '• Cap: 50k per wallet per day (UTC)',
  '',
  'Build a kit → Enter Arena → fight. $HELL',
].join('\n');

const discordBody = [
  '## ARENA + STREAM — rewards $HELL (LIVE)',
  '',
  'Todo sale del mismo pool diario de mining (500k/día) con tope de **50.000 $HELL por wallet por día (UTC)**.',
  '',
  '### 1) AFK en Bleeding Island',
  '- Estar **≥ 2 horas** en el mapa de Arena (Bleeding Island lobby)',
  '- **+5.000 $HELL** pending / día',
  '- **Anti-AFK desactivado** en ese mapa: podés dejar el char AFK sin kick',
  '',
  '### 2) Duelos',
  '- Ganador **+7.000 $HELL** · perdedor **+3.000 $HELL** (si se termina el tiempo sin ganador, 3.000 cada uno)',
  '- **1 duelo pagado por día contra el mismo rival**; máximo **5 duelos pagos** por día',
  '- Los premios extra de Arena los pone el **treasury** — no hay bolsa entre jugadores',
  '',
  '### 3) Stream en X',
  '- Transmití en vivo en **X** al menos **15 minutos** con el link en la **cartelera** (duel público o Go Live)',
  '- Ese día completás los **50.000 $HELL** (hasta el tope de wallet)',
  '',
  '### Cómo entrar',
  '1. Login con wallet → **Ir a Arena**',
  '2. Create / Pre-Ready fighter → **Enter Bleeding Island** o **Create PVP Duel**',
  '3. Para el stream: pegá tu link de X live en el duel (POV o global cam) o en Go Live',
  '',
  '_Pending $HELL va al ledger de play-mine (claim on-chain cuando el mint esté live). Utility / incentives — no es salary ni ROI._',
  '',
  'GL HF — Chain Lords Arena',
].join('\n');

async function postX() {
  const st = getXApiStatus();
  if (!st.ok) {
    console.error('X_NOT_CONFIGURED', st.reason);
    return { ok: false, reason: st.reason };
  }
  if (xText.length > 280) {
    console.error('X text too long', xText.length);
    return { ok: false, reason: `too long ${xText.length}` };
  }
  console.log('X cost estimate', estimatePostCost(xText));
  const r = await createPost(xText);
  console.log('X OK', r.url);
  return { ok: true, ...r };
}

async function postDiscord() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) {
    console.error('missing DISCORD_BOT_TOKEN');
    return { ok: false, reason: 'no token' };
  }

  const embed = new EmbedBuilder()
    .setColor(0xe0b45a)
    .setTitle('ARENA — incentivos $HELL LIVE')
    .setDescription(discordBody)
    .setFooter({ text: 'Chain Lords · UTC day reset · pending $HELL ledger' })
    .setTimestamp(new Date());

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  return await new Promise((resolve) => {
    let settled = false;
    const run = async () => {
      if (settled) return;
      settled = true;
      const ids = [ANNOUNCE_CHANNEL_ID, ARENA_NEWS_CHANNEL_ID].filter(Boolean);
      const posted = [];
      try {
        for (const id of ids) {
          try {
            const ch = await client.channels.fetch(id);
            if (!ch || typeof ch.send !== 'function') {
              console.warn('skip channel', id);
              continue;
            }
            const msg = await ch.send({ embeds: [embed] });
            console.log('Discord OK', id, msg.id);
            posted.push({ channelId: id, messageId: msg.id });
          } catch (e) {
            console.error('Discord channel fail', id, e.message || e);
          }
        }
        resolve({ ok: posted.length > 0, posted });
      } catch (e) {
        resolve({ ok: false, reason: String(e.message || e) });
      } finally {
        client.destroy();
      }
    };
    client.once('ready', run);
    client.once('clientReady', run);
    client.login(token).catch((e) => {
      console.error(e);
      if (!settled) {
        settled = true;
        resolve({ ok: false, reason: String(e.message || e) });
      }
    });
  });
}

const x = await postX();
const d = await postDiscord();
console.log(JSON.stringify({ x, d }, null, 2));
if (!x.ok && !d.ok) process.exit(1);
