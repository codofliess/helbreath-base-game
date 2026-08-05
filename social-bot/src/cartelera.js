/**
 * CHAIN LORDS TV → Discord Events + optional channel embed.
 * Polls game public API and upserts Guild Scheduled Events for public PVP.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

const GAME_API = (
  process.env.GAME_STREAMS_API ||
  process.env.CHAINLORDS_GAME_API ||
  'https://play.chainlords.net'
).replace(/\/$/, '');

const PLAY_URL = (process.env.PLAY_URL || 'https://play.chainlords.net').replace(/\/$/, '');
const GUILD_ID = (process.env.DISCORD_GUILD_ID || '').trim();
const EVENTS_CHANNEL_ID = (
  process.env.DISCORD_EVENTS_CHANNEL_ID ||
  process.env.DISCORD_ANNOUNCE_CHANNEL_ID ||
  ''
).trim();
const POLL_MS = Number(process.env.CARTELERA_POLL_MS || 5 * 60 * 1000);

/** @type {Map<string, string>} matchId → discord scheduled event id */
const eventMap = new Map();

export function carteleraSlashCommands() {
  return [
    new SlashCommandBuilder()
      .setName('tv')
      .setDescription('CHAIN LORDS TV — live & weekly PVP / World schedule')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('cartelera')
      .setDescription('Same as /tv — live streams and scheduled duels')
      .toJSON(),
  ];
}

async function fetchCartelera() {
  const res = await fetch(`${GAME_API}/api/streams`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`streams HTTP ${res.status}`);
  }
  return res.json();
}

function fightersLine(d) {
  const fs = (d.fighters || []).map((f) => f.name).filter(Boolean);
  return fs.length ? fs.join(' vs ') : d.hostName || 'TBD';
}

function isLive(st) {
  return ['live', 'countdown', 'tech_sample', 'tech_agree', 'ready_window'].includes(st);
}

export function buildTvEmbed(data) {
  const pvpLive = data?.stages?.pvp?.live || [];
  const pvpUp = data?.stages?.pvp?.upcoming || [];
  const world = data?.stages?.world?.live || [];
  const tourney = data?.stages?.tournament?.live || [];

  const liveLines = [];
  for (const d of pvpLive) {
    liveLines.push(
      `🔴 **PVP** ${d.title || fightersLine(d)} — [Watch](${d.watchUrl || `${PLAY_URL}/?watch=${d.matchId}`})`,
    );
  }
  for (const w of world) {
    liveLines.push(
      `🔴 **WORLD** ${w.characterName}: ${w.title}${w.streamUrl ? ` — [Stream](${w.streamUrl})` : ''}`,
    );
  }
  for (const t of tourney) {
    liveLines.push(
      `🔴 **TOURNEY** ${t.title}${t.streamUrl ? ` — [Stream](${t.streamUrl})` : ''}`,
    );
  }

  const schedLines = pvpUp.slice(0, 12).map((d) => {
    const when = d.opensAtMs
      ? `<t:${Math.floor(Number(d.opensAtMs) / 1000)}:f>`
      : '?';
    return `⚔️ ${when} · **${d.title || fightersLine(d)}** · \`${d.mapId || '?'}\``;
  });

  const embed = new EmbedBuilder()
    .setColor(0xc9a227)
    .setTitle('📺 CHAIN LORDS TV')
    .setDescription(
      'Weekly PVP · World streamers · Tournaments\n' +
        `[Open multi-cam on play](${PLAY_URL}/?watch=streams) · [Landing schedule](https://www.chainlords.net/#cl-tv)`,
    )
    .setTimestamp(new Date())
    .setFooter({ text: 'Cartelera · stage always ready' });

  embed.addFields({
    name: '🔴 LIVE NOW',
    value: liveLines.length ? liveLines.join('\n').slice(0, 1020) : '_Nothing live — stage is ready for tests._',
  });
  embed.addFields({
    name: '📋 Scheduled public duels',
    value: schedLines.length
      ? schedLines.join('\n').slice(0, 1020)
      : '_No public duels yet. Publish from Create PVP Duel._',
  });

  return embed;
}

/**
 * Sync public upcoming PVP into Discord Guild Scheduled Events (external location = watch URL).
 */
export async function syncScheduledEvents(client) {
  if (!GUILD_ID) {
    return { ok: false, reason: 'no GUILD_ID' };
  }
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    return { ok: false, reason: 'guild fetch failed' };
  }

  let data;
  try {
    data = await fetchCartelera();
  } catch (e) {
    return { ok: false, reason: e.message };
  }

  const upcoming = data?.stages?.pvp?.upcoming || [];
  const me = guild.members.me;
  if (!me?.permissions?.has(PermissionFlagsBits.ManageEvents)) {
    console.warn('[cartelera] Missing Manage Events permission');
    return { ok: false, reason: 'missing Manage Events' };
  }

  let created = 0;
  let updated = 0;
  for (const d of upcoming) {
    const matchId = d.matchId;
    if (!matchId || !d.opensAtMs) continue;
    let start = new Date(Number(d.opensAtMs));
    if (start.getTime() < Date.now() + 60_000) {
      start = new Date(Date.now() + 120_000);
    }
    const end = new Date(start.getTime() + 45 * 60_000);
    const name = (`⚔️ ${(d.title || fightersLine(d)).slice(0, 90)}`).slice(0, 100);
    const location = (d.watchUrl || `${PLAY_URL}/?watch=${matchId}`).slice(0, 100);
    const description = [
      `PVP public duel`,
      `Map: ${d.mapId || '?'}`,
      `Fighters: ${fightersLine(d)}`,
      `Watch: ${location}`,
      `Landing: https://www.chainlords.net/#cl-tv`,
    ]
      .join('\n')
      .slice(0, 1000);

    const existingId = eventMap.get(matchId);
    try {
      if (existingId) {
        const ev = await guild.scheduledEvents.fetch(existingId).catch(() => null);
        if (ev) {
          await ev.edit({
            name,
            description,
            scheduledStartTime: start,
            scheduledEndTime: end,
            entityMetadata: { location },
          });
          updated++;
          continue;
        }
        eventMap.delete(matchId);
      }
      const createdEv = await guild.scheduledEvents.create({
        name,
        description,
        scheduledStartTime: start,
        scheduledEndTime: end,
        privacyLevel: 2,
        entityType: 3, // EXTERNAL
        entityMetadata: { location },
      });
      eventMap.set(matchId, createdEv.id);
      created++;
    } catch (err) {
      console.warn('[cartelera] event upsert', matchId, err.message);
    }
  }

  return { ok: true, created, updated, upcoming: upcoming.length };
}

export async function handleTvCommand(interaction) {
  await interaction.deferReply({ ephemeral: false });
  try {
    const data = await fetchCartelera();
    const embed = buildTvEmbed(data);
    await interaction.editReply({ embeds: [embed] });
  } catch (e) {
    await interaction.editReply({
      content: `Could not load cartelera: ${e.message}`,
    });
  }
}

/**
 * Start background poll: Events sync + optional channel post every N ms.
 */
export function startCarteleraLoop(client) {
  const tick = async () => {
    try {
      const r = await syncScheduledEvents(client);
      if (r.ok) {
        console.log(
          `[cartelera] events sync created=${r.created} updated=${r.updated} upcoming=${r.upcoming}`,
        );
      } else if (r.reason) {
        console.log(`[cartelera] skip: ${r.reason}`);
      }
    } catch (e) {
      console.warn('[cartelera] loop', e.message);
    }
  };

  // First run after ready
  setTimeout(() => void tick(), 15_000);
  setInterval(() => void tick(), Math.max(60_000, POLL_MS));
}

export async function postCarteleraToChannel(client) {
  if (!EVENTS_CHANNEL_ID) return;
  const ch = await client.channels.fetch(EVENTS_CHANNEL_ID).catch(() => null);
  if (!ch || !ch.isTextBased?.()) return;
  try {
    const data = await fetchCartelera();
    const embed = buildTvEmbed(data);
    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.warn('[cartelera] channel post', e.message);
  }
}
