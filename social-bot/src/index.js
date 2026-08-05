/**
 * Chain Lord Discord bot — FAQ via slash / free-text (when Message Content Intent is on).
 *
 * Setup:
 * 1. Copy .env.example → .env and fill tokens
 * 2. Discord Portal: enable Message Content Intent for free-text in #support
 *    (slash /faq works without it)
 * 3. npm install && npm start
 */
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { chatCompletion } from './xai.js';
import { staticFaqReply } from './staticFaq.js';
import {
  addDraft,
  listDrafts,
  getDraft,
  markPosted,
  formatForX,
  formatDraftCard,
} from './contentQueue.js';
import { createPost, getXApiStatus, estimatePostCost } from './xApi.js';
import {
  carteleraSlashCommands,
  handleTvCommand,
  startCarteleraLoop,
} from './cartelera.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const token = process.env.DISCORD_BOT_TOKEN;
const marketApi = (
  process.env.MARKET_API_URL ||
  process.env.MIDDLEWARE_URL ||
  'http://127.0.0.1:3001'
).replace(/\/$/, '');
const marketLanding =
  process.env.MARKET_LANDING_URL || 'https://www.chainlords.net/market.html';
const xaiKey = (process.env.XAI_API_KEY || '').trim();
// FAQ channel: cheapest high-volume model (PO: 4.1 Fast for Discord FAQ).
// XAI_MODEL_FAQ wins; XAI_MODEL kept as legacy alias.
const modelFaq =
  (process.env.XAI_MODEL_FAQ || process.env.XAI_MODEL || 'grok-4-1-fast-non-reasoning').trim();
const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const maxChars = Number(process.env.MAX_REPLY_CHARS || 900);
const cooldownMs = Number(process.env.COOLDOWN_MS || 4000);
const maxHistory = Number(process.env.MAX_HISTORY_TURNS || 6);
const useLlm = xaiKey.length > 8;
/** Set DISCORD_MESSAGE_CONTENT=1 only after enabling the privileged intent in the portal */
const wantMessageContent =
  process.env.DISCORD_MESSAGE_CONTENT === '1' ||
  process.env.DISCORD_MESSAGE_CONTENT === 'true';

const supportChannelIds = new Set(
  (process.env.DISCORD_SUPPORT_CHANNEL_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const opsLogChannelId = (process.env.DISCORD_OPS_LOG_CHANNEL_ID || '').trim();
const guildId = (process.env.DISCORD_GUILD_ID || '').trim();
const announceChannelId = (process.env.DISCORD_ANNOUNCE_CHANNEL_ID || '').trim();
const officialX = (process.env.OFFICIAL_X_URL || 'https://x.com/ChainLordsHQ').trim();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!token) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}
if (!useLlm) {
  console.warn('[ChainLord bot] XAI_API_KEY missing — using static FAQ only');
}
if (!wantMessageContent) {
  console.warn(
    '[ChainLord bot] Message Content Intent OFF (DISCORD_MESSAGE_CONTENT≠1). Free-text in #support needs portal intent + env=1. Slash /faq and DMs still work.',
  );
}

const systemPrompt = buildSystemPrompt(process.env);
/** @type {Map<string, number>} */
const lastReplyAt = new Map();
/** @type {Map<string, {role:string,content:string}[]>} */
const histories = new Map();

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.DirectMessages,
];
if (wantMessageContent) {
  intents.push(GatewayIntentBits.MessageContent);
}

const client = new Client({
  intents,
  partials: [Partials.Channel, Partials.Message],
});

const slashFaq = new SlashCommandBuilder()
  .setName('faq')
  .setDescription('Ask the Chain Lords FAQ bot (EN/ES)')
  .addStringOption((opt) =>
    opt
      .setName('question')
      .setDescription('Your question (play, wallet, mint, arena, AFK, $HELL…)')
      .setRequired(true)
      .setMaxLength(500),
  );

const slashMarket = new SlashCommandBuilder()
  .setName('market')
  .setDescription('Search Auction House offers (side door)')
  .addStringOption((opt) =>
    opt
      .setName('query')
      .setDescription('Item e.g. merien stones, xelima')
      .setRequired(true)
      .setMaxLength(120),
  );

/** Staff content ops: drafts for X + Discord (see docs/social/CONTENT-OPS-X-DISCORD.md) */
const slashContent = new SlashCommandBuilder()
  .setName('content')
  .setDescription('Staff: queue X/Discord drafts (ops content)')
  .addSubcommand((sc) =>
    sc
      .setName('draft')
      .setDescription('Save a draft for X and/or Discord')
      .addStringOption((o) =>
        o
          .setName('platform')
          .setDescription('Where this will ship')
          .setRequired(true)
          .addChoices(
            { name: 'X only', value: 'x' },
            { name: 'Discord only', value: 'discord' },
            { name: 'Both', value: 'both' },
          ),
      )
      .addStringOption((o) =>
        o.setName('body').setDescription('Post text').setRequired(true).setMaxLength(1800),
      )
      .addStringOption((o) =>
        o.setName('title').setDescription('Short label').setRequired(false).setMaxLength(80),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName('list')
      .setDescription('List recent drafts')
      .addIntegerOption((o) =>
        o.setName('limit').setDescription('How many (default 8)').setMinValue(1).setMaxValue(20),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName('show')
      .setDescription('Show draft + X-sized copy')
      .addStringOption((o) => o.setName('id').setDescription('Draft id').setRequired(true)),
  )
  .addSubcommand((sc) =>
    sc
      .setName('post-discord')
      .setDescription('Post draft body to announcements channel')
      .addStringOption((o) => o.setName('id').setDescription('Draft id').setRequired(true)),
  )
  .addSubcommand((sc) =>
    sc
      .setName('post-x')
      .setDescription('Post draft to @ChainLordsHQ via X API (pay-per-use)')
      .addStringOption((o) => o.setName('id').setDescription('Draft id').setRequired(true))
      .addBooleanOption((o) =>
        o
          .setName('confirm')
          .setDescription('Must be true to actually post (spends X API credits)')
          .setRequired(true),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName('post-both')
      .setDescription('Post draft to X + Discord announcements')
      .addStringOption((o) => o.setName('id').setDescription('Draft id').setRequired(true))
      .addBooleanOption((o) =>
        o
          .setName('confirm')
          .setDescription('Must be true to actually post')
          .setRequired(true),
      ),
  )
  .addSubcommand((sc) =>
    sc.setName('x-status').setDescription('X API credentials + pricing status'),
  )
  .addSubcommand((sc) =>
    sc.setName('pack-load').setDescription('Load week1 content pack into the draft queue'),
  )
  .addSubcommand((sc) =>
    sc.setName('x-handle').setDescription('Show official X handle + links'),
  );

function isStaffMember(member) {
  if (!member) return false;
  if (member.permissions?.has?.('Administrator')) return true;
  if (member.permissions?.has?.('ManageGuild')) return true;
  const names = new Set(
    [...(member.roles?.cache?.values?.() || [])].map((r) => (r.name || '').toLowerCase()),
  );
  return names.has('staff') || names.has('mod') || names.has('bot');
}

async function marketSearch(query) {
  const url = `${marketApi}/market/search?q=${encodeURIComponent(query)}&limit=12`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`market API ${res.status}: ${t.slice(0, 120)}`);
  }
  return res.json();
}

function formatMarketEmbed(query, data) {
  const rows = data.results || [];
  if (!rows.length) {
    return `No active offers for **${query}**.\nBrowse: ${marketLanding}`;
  }
  const lines = rows.slice(0, 10).map((r) => {
    return `• **${r.quantity}× ${r.itemName}** — ${r.priceUsdc} USDC (${r.unitUsdc}/u) · ${r.sellerCity || '?'} · \`${r.listingId}\``;
  });
  return [
    `**Market** · \`${query}\` · ${rows.length} hit(s) · fee ${data.feePercent ?? '?'}%`,
    ...lines,
    '',
    `Mobile buy + Grok order: ${marketLanding}?q=${encodeURIComponent(query)}`,
  ].join('\n');
}

function historyKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

function shouldHandleMessage(message) {
  if (message.author.bot) return false;
  const text = message.content || '';
  // Without Message Content Intent, guild free-text arrives empty — skip
  if (!text.trim()) return false;
  if (message.channel.type === ChannelType.DM) return true;
  if (supportChannelIds.size > 0 && supportChannelIds.has(message.channelId)) {
    return true;
  }
  if (client.user && message.mentions.has(client.user)) return true;
  return false;
}

function stripMention(content) {
  if (!client.user) return content;
  return content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
}

function cooldownOk(key) {
  const now = Date.now();
  const last = lastReplyAt.get(key) || 0;
  if (now - last < cooldownMs) return false;
  lastReplyAt.set(key, now);
  return true;
}

function pushHistory(key, role, content) {
  const list = histories.get(key) || [];
  list.push({ role, content });
  while (list.length > maxHistory * 2) {
    list.shift();
  }
  histories.set(key, list);
}

async function answerQuestion(userText, histKey) {
  pushHistory(histKey, 'user', userText);

  let out;
  if (useLlm) {
    try {
      const reply = await chatCompletion({
        apiKey: xaiKey,
        baseUrl,
        model: modelFaq,
        channel: 'faq',
        temperature: 0.35,
        maxTokens: 450,
        system: systemPrompt,
        messages: histories.get(histKey) || [{ role: 'user', content: userText }],
      });
      out = reply.length > maxChars ? `${reply.slice(0, maxChars - 1)}…` : reply;
    } catch (llmErr) {
      console.warn('[llm fallback]', llmErr.message);
      out = staticFaqReply(userText);
    }
  } else {
    out = staticFaqReply(userText);
  }

  pushHistory(histKey, 'assistant', out);
  return out;
}

async function logOps(text) {
  if (!opsLogChannelId) return;
  try {
    const ch = await client.channels.fetch(opsLogChannelId);
    if (ch && ch.isTextBased()) {
      await ch.send({ content: text.slice(0, 1900) });
    }
  } catch (e) {
    console.warn('[ops-log]', e.message);
  }
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  const body = [
    slashFaq.toJSON(),
    slashMarket.toJSON(),
    slashContent.toJSON(),
    ...carteleraSlashCommands(),
  ];
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body,
    });
    console.log(
      `[ChainLord bot] registered /faq + /market + /content + /tv + /cartelera on guild ${guildId}`,
    );
  } else {
    await rest.put(Routes.applicationCommands(client.user.id), { body });
    console.log('[ChainLord bot] registered global slash commands (may take up to ~1h)');
  }
}

async function handleContentCommand(interaction) {
  const member = interaction.member;
  if (!isStaffMember(member)) {
    await interaction.reply({
      content: 'Staff/Mod only. Content queue is for ops.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'x-handle') {
    const st = getXApiStatus();
    await interaction.reply({
      content: [
        `**Official X:** ${officialX}`,
        `Handle: **@ChainLordsHQ**`,
        `Play: ${process.env.OFFICIAL_PLAY_URL || 'https://play.chainlords.net'}`,
        `Discord: ${process.env.OFFICIAL_DISCORD_URL || 'https://discord.gg/F4NwwbfKtj'}`,
        `X API: ${st.ok ? '✅ keys loaded' : `❌ ${st.reason}`}`,
        '',
        'Workflow: `/content draft` → `/content post-x id:… confirm:true` (or post-discord / post-both).',
        'Setup: `docs/social/X-API-SETUP.md` · Ops: `docs/social/CONTENT-OPS-X-DISCORD.md`',
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'x-status') {
    const st = getXApiStatus();
    await interaction.reply({
      content: [
        '**X API status**',
        st.ok ? '✅ OAuth 1.0a env vars present' : `❌ ${st.reason}`,
        '',
        '**Pay-per-use (approx):** text post **$0.015** · post **with URL $0.20**',
        'Prefer no https:// in body (put links in bio) to save credits.',
        '',
        `Account: ${officialX}`,
        'Console: https://console.x.com · Docs: docs/social/X-API-SETUP.md',
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'draft') {
    const platform = interaction.options.getString('platform', true);
    const body = interaction.options.getString('body', true);
    const title = interaction.options.getString('title') || '';
    const d = addDraft({
      platform,
      body,
      title,
      authorTag: interaction.user.tag,
    });
    await interaction.reply({
      content: `Saved draft **#${d.id}** (${d.platform}).\n${formatDraftCard(d)}\n\n**X copy (≤280):**\n\`\`\`\n${formatForX(d.body)}\n\`\`\``,
      flags: MessageFlags.Ephemeral,
    });
    await logOps(`**${interaction.user.tag}** saved content draft #${d.id} (${platform})`);
    return;
  }

  if (sub === 'list') {
    const limit = interaction.options.getInteger('limit') || 8;
    const rows = listDrafts(limit);
    if (!rows.length) {
      await interaction.reply({
        content: 'Queue empty. Try `/content pack-load` or `/content draft`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const lines = rows.map(
      (d) =>
        `**#${d.id}** \`${d.platform}\` *${d.status}* — ${(d.title || d.body).slice(0, 60)}…`,
    );
    await interaction.reply({
      content: lines.join('\n').slice(0, 1900),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'show') {
    const id = interaction.options.getString('id', true);
    const d = getDraft(id);
    if (!d) {
      await interaction.reply({ content: `No draft #${id}`, flags: MessageFlags.Ephemeral });
      return;
    }
    const xText = formatForX(d.body);
    const cost = estimatePostCost(xText);
    await interaction.reply({
      content: [
        formatDraftCard(d),
        '',
        '**Ready for X (≤280):**',
        '```',
        xText,
        '```',
        `Est. API cost: **~$${cost.approxUsd.toFixed(3)}** — ${cost.note}`,
        `${officialX}`,
        `Post: \`/content post-x id:${d.id} confirm:true\``,
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'post-discord') {
    const id = interaction.options.getString('id', true);
    const d = getDraft(id);
    if (!d) {
      await interaction.reply({ content: `No draft #${id}`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!announceChannelId) {
      await interaction.reply({
        content:
          'Set `DISCORD_ANNOUNCE_CHANNEL_ID` in social-bot `.env` to your #announcements channel ID.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    try {
      const ch = await client.channels.fetch(announceChannelId);
      if (!ch || !ch.isTextBased()) {
        await interaction.reply({
          content: 'Announce channel not text-based or missing.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await ch.send({ content: d.body.slice(0, 2000) });
      markPosted(id, 'discord');
      await interaction.reply({
        content: `Posted draft **#${id}** to announcements.`,
        flags: MessageFlags.Ephemeral,
      });
      await logOps(`**${interaction.user.tag}** posted content #${id} → Discord announcements`);
    } catch (e) {
      await interaction.reply({
        content: `Failed to post: ${e.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (sub === 'post-x' || sub === 'post-both') {
    const id = interaction.options.getString('id', true);
    const confirm = interaction.options.getBoolean('confirm', true);
    const d = getDraft(id);
    if (!d) {
      await interaction.reply({ content: `No draft #${id}`, flags: MessageFlags.Ephemeral });
      return;
    }
    const xText = formatForX(d.body);
    const cost = estimatePostCost(xText);
    if (!confirm) {
      await interaction.reply({
        content: [
          `Preview only (not posted). Re-run with **confirm:true** to spend credits.`,
          formatDraftCard(d),
          '```',
          xText,
          '```',
          `Est. ~$${cost.approxUsd.toFixed(3)} — ${cost.note}`,
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const st = getXApiStatus();
    if (!st.ok) {
      await interaction.reply({ content: `❌ ${st.reason}`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const posted = await createPost(xText);
      markPosted(id, sub === 'post-both' ? 'x+pending-discord' : 'x');
      let discordNote = '';
      if (sub === 'post-both') {
        if (!announceChannelId) {
          discordNote =
            '\n⚠️ X OK but Discord skipped — set `DISCORD_ANNOUNCE_CHANNEL_ID`.';
        } else {
          try {
            const ch = await client.channels.fetch(announceChannelId);
            if (ch?.isTextBased()) {
              await ch.send({ content: d.body.slice(0, 2000) });
              markPosted(id, 'x+discord');
              discordNote = '\n✅ Also posted to Discord announcements.';
            }
          } catch (e) {
            discordNote = `\n⚠️ X OK; Discord failed: ${e.message}`;
          }
        }
      }
      await interaction.editReply({
        content: [
          `✅ Posted to X as **@ChainLordsHQ**`,
          posted.url,
          `Est. cost ~$${cost.approxUsd.toFixed(3)}`,
          discordNote,
        ]
          .filter(Boolean)
          .join('\n'),
      });
      await logOps(
        `**${interaction.user.tag}** \`/content ${sub}\` #${id} → ${posted.url} (~$${cost.approxUsd})`,
      );
    } catch (e) {
      await interaction.editReply({
        content: `❌ X post failed: ${e.message}`,
      });
      await logOps(`**${interaction.user.tag}** X post #${id} FAILED: ${e.message}`);
    }
    return;
  }

  if (sub === 'pack-load') {
    const packPath = path.join(__dirname, '..', 'data', 'week1-content-pack.json');
    if (!fs.existsSync(packPath)) {
      await interaction.reply({
        content: 'week1-content-pack.json missing.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    let n = 0;
    for (const p of pack.posts || []) {
      addDraft({
        platform: p.platform || 'both',
        title: p.title || p.id || '',
        body: p.body || '',
        authorTag: `pack:${interaction.user.tag}`,
      });
      n += 1;
    }
    await interaction.reply({
      content: `Loaded **${n}** drafts from week1 pack. Use \`/content list\` then \`/content show id:\` → \`/content post-x id:… confirm:true\`.`,
      flags: MessageFlags.Ephemeral,
    });
    await logOps(`**${interaction.user.tag}** loaded week1 content pack (${n})`);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(
    `[ChainLord bot] logged in as ${c.user.tag} · mode=${useLlm ? `llm:faq=${modelFaq}` : 'static-faq'} · msgContent=${wantMessageContent ? 'on' : 'off'}`,
  );
  try {
    await registerCommands();
  } catch (e) {
    console.error('[commands]', e.message);
  }
  // Sync public PVP into Discord Scheduled Events + keep /tv data fresh.
  startCarteleraLoop(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'tv' || interaction.commandName === 'cartelera') {
    try {
      await handleTvCommand(interaction);
    } catch (err) {
      console.error('[tv]', err);
      const msg = 'TV command failed.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.commandName === 'content') {
    try {
      await handleContentCommand(interaction);
    } catch (err) {
      console.error('[content]', err);
      const msg = 'Content command failed.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.commandName === 'market') {
    const query = interaction.options.getString('query', true).trim();
    const key = historyKey(interaction.channelId, interaction.user.id);
    if (!cooldownOk(key)) {
      await interaction.reply({
        content: '⏳ Slow down a few seconds, then try again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    try {
      await interaction.deferReply();
      const data = await marketSearch(query);
      const out = formatMarketEmbed(query, data);
      await interaction.editReply({ content: out.slice(0, 2000) });
      await logOps(
        `**${interaction.user.tag}** \`/market\` \`${query}\` → ${data.count ?? 0} hits`,
      );
    } catch (err) {
      console.error('[market]', err);
      const msg = `Market API offline or error. Try ${marketLanding}\n\`${err.message}\``;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg.slice(0, 2000) }).catch(() => {});
      } else {
        await interaction.reply({ content: msg.slice(0, 2000), flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.commandName !== 'faq') return;

  const text = interaction.options.getString('question', true).trim();
  const key = historyKey(interaction.channelId, interaction.user.id);

  if (!cooldownOk(key)) {
    await interaction.reply({
      content: '⏳ Slow down a few seconds, then try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await interaction.deferReply();
    const out = await answerQuestion(text, key);
    await interaction.editReply({ content: out.slice(0, 2000) });
    await logOps(
      `**${interaction.user.tag}** \`/faq\` in \`${interaction.channelId}\` [${useLlm ? 'llm' : 'static'}]\n> ${text.slice(0, 200)}\n→ ${out.slice(0, 400)}`,
    );
  } catch (err) {
    console.error('[interaction]', err);
    const msg = 'Bot hiccup. Try again or ping a human mod in #support.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (!shouldHandleMessage(message)) return;

    const text = stripMention(message.content || '');
    if (!text) {
      await message.reply(
        'Ask me about Helbreath Chain Lords — or use **`/faq question:`** (works without free-text intent).',
      );
      return;
    }

    const key = historyKey(message.channelId, message.author.id);
    if (!cooldownOk(key)) {
      await message.react('⏳').catch(() => {});
      return;
    }

    await message.channel.sendTyping();
    const out = await answerQuestion(text, key);
    await message.reply({ content: out.slice(0, 2000) });
    await logOps(
      `**${message.author.tag}** in \`${message.channel.type === ChannelType.DM ? 'DM' : message.channelId}\` [${useLlm ? 'llm' : 'static'}]\n> ${text.slice(0, 200)}\n→ ${out.slice(0, 400)}`,
    );
  } catch (err) {
    console.error('[message]', err);
    try {
      await message.reply(
        'Bot hiccup. Try **`/faq`** or ping a human mod in #support.',
      );
    } catch {
      /* ignore */
    }
  }
});

client.login(token);
