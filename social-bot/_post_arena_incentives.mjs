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
  'ARENA incentives LIVE on Chain Lords',
  '',
  '• AFK 2h on Bleeding Island → 5k HELL/day (anti-AFK off)',
  '• Any duel (win or lose) → 10k HELL (max 5/day)',
  '• Discord Go Live ≥15m on landing → 20k/duel',
  '• Combined daily cap: 100k HELL (UTC)',
  '',
  'Build a kit → Enter Arena → farm or fight. $HELL',
].join('\n');

const discordBody = [
  '## ARENA — nuevos incentivos $HELL (LIVE)',
  '',
  'Subimos las recompensas para que valga la pena **quedarse en Arena** y **pelear duelos**.',
  '',
  '### 1) AFK en Bleeding Island',
  '- Estar **≥ 2 horas** en el mapa de Arena (Bleeding Island lobby)',
  '- **+5.000 $HELL** pending / día (UTC)',
  '- **Anti-AFK desactivado** en ese mapa: podés dejar el char AFK sin kick',
  '',
  '### 2) Duelos (gana o pierde)',
  '- Cada duel completado (win **o** loss) → **+10.000 $HELL**',
  '- Máximo **5 cobros de duelo** por día UTC, después capea hasta mañana',
  '',
  '### 3) Bonus stream Discord → landing',
  '- Si además compartís pantalla / Go Live de **Discord** a la **landing** al menos **15 minutos**',
  '- El duelo paga **doble: +20.000 $HELL**',
  '',
  '### Cap diario',
  '- Entre AFK + duelos (con o sin stream): **máximo 100.000 $HELL / día UTC**',
  '',
  '### Cómo entrar',
  '1. Login con wallet → **Ir a Arena**',
  '2. Create / Pre-Ready fighter → **Enter Bleeding Island** o **Create PVP Duel**',
  '3. Para el bonus: seteá stream Discord en el duel (POV o global cam) y dejal o ≥15m en cartelera',
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
