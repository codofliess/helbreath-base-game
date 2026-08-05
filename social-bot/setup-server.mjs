/**
 * Bootstrap Chain Lords Discord — condensed Olympia-style layout + ops automation hooks.
 *
 * Prerequisites:
 * 1. Create empty server "Chain Lords" in Discord (you as owner)
 * 2. https://discord.com/developers/applications → New App → Bot
 *    - Enable MESSAGE CONTENT INTENT
 * 3. OAuth2 URL Generator: scopes bot + applications.commands
 *    Permissions integer: 8 (Administrator) for first setup, or:
 *    Manage Channels, Manage Roles, Manage Messages, Send Messages, Embed Links,
 *    Read Message History, Create Instant Invite, Mention Everyone (optional)
 * 4. Invite bot to the empty server
 * 5. Copy Server ID (Discord Settings → Advanced → Developer Mode → right-click server → Copy ID)
 * 6. Copy Bot Token
 *
 * Run:
 *   cd social-bot
 *   copy .env.example .env   # set DISCORD_BOT_TOKEN + DISCORD_GUILD_ID
 *   npm install
 *   node setup-server.mjs
 *
 * Safe to re-run: skips roles/channels that already exist by name.
 */
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!token || !guildId) {
  console.error("Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in social-bot/.env");
  process.exit(1);
}

const COLORS = {
  staff: 0xc4a050,
  mod: 0x5865f2,
  bot: 0x57f287,
  tester: 0xfee75c,
};

/** @type {{ name: string; color: number; perms?: bigint[] }[]} */
const ROLES = [
  { name: "Staff", color: COLORS.staff, perms: [PermissionFlagsBits.Administrator] },
  {
    name: "Mod",
    color: COLORS.mod,
    perms: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
    ],
  },
  { name: "Bot", color: COLORS.bot },
  { name: "Tester", color: COLORS.tester },
];

/**
 * Condensed layout (Olympia-like, fewer channels).
 * type: 0 text, 2 voice, 4 category, 5 announcement (guild news)
 */
const STRUCTURE = [
  {
    category: "INFO",
    channels: [
      { name: "welcome", topic: "Rules + official links. Staff never asks for seed phrases." },
      {
        name: "announcements",
        topic: "Official news only — patches, test windows, Sunday Arena.",
        staffOnlyWrite: true,
        // Text channel (not GuildAnnouncement) — works without Community features enabled
      },
      {
        name: "status",
        topic: "Server online / maintenance / incidents.",
        staffOnlyWrite: true,
      },
      {
        name: "links",
        topic: "chainlords.net · play · socials",
        staffOnlyWrite: true,
      },
    ],
  },
  {
    category: "COMMUNITY",
    channels: [
      { name: "general", topic: "Main chat — EN/ES welcome." },
      { name: "lfg", topic: "Looking for party / world group." },
      { name: "guilds", topic: "Looking for guild / recruit." },
      { name: "media", topic: "Screenshots, EK clips, short videos." },
    ],
  },
  {
    category: "PLAYTEST",
    channels: [
      {
        name: "how-to-play",
        topic: "Wallet (Phantom), play URL, known issues. Staff updates.",
        staffOnlyWrite: true,
      },
      {
        name: "bug-reports",
        topic: "Bugs only. Template in pinned message.",
      },
      {
        name: "support",
        topic: "Help + FAQ. Bot + mods. No seed phrases.",
      },
    ],
  },
  {
    category: "ARENA",
    channels: [
      {
        name: "arena-news",
        topic: "Sunday 1v1 / 3v3 inscriptions & results.",
        staffOnlyWrite: true,
      },
      { name: "arena-lfg", topic: "Find 3v3 teammates / 1v1 sparring." },
    ],
  },
  {
    category: "VOICE",
    channels: [
      { name: "Lobby", voice: true },
      { name: "World", voice: true },
      { name: "Arena", voice: true },
    ],
  },
  {
    category: "STAFF",
    staffOnly: true,
    channels: [
      { name: "ops", topic: "Daily ops, incidents, deploys." },
      { name: "ops-content", topic: "Draft tweets / Discord posts for approval." },
      { name: "ops-bot-log", topic: "Bot FAQ logs." },
      { name: "ops-infra", topic: "VPS, DNS, Railway, mail." },
    ],
  },
];

const WELCOME = `## Welcome to **Chain Lords**

Old-school **city-war MMO** in the browser · Solana utility · public test soon.

**Official site:** https://www.chainlords.net  
**Play link:** announced only in <#announcements> (never trust random DMs)

### Rules (short)
1. No investment advice / “guaranteed airdrop $”.
2. **Staff never DMs first** asking for wallet connect or **seed phrases**.
3. No harassment, doxx, cheat selling.
4. Bugs → <#bug-reports> with steps + screenshot.
5. EN + ES welcome.

### Identity
We are **Chain Lords** — classic isometric city-war feel, own brand. **Not** an official Helbreath product.

Stay safe: Phantom seeds only on **paper**, never in chat.
`;

const BUG_TEMPLATE = `**Bug report template** (copy & fill):

\`\`\`
**Title:**
**OS / Browser:**
**Character / wallet last 4:**
**Steps:**
1.
2.
**Expected:**
**Actual:**
**Screenshot:**
\`\`\`
`;

const LINKS = `**Official links**
• Site: https://www.chainlords.net
• Arena 1v1: https://www.chainlords.net/arena-1v1.html
• Arena 3v3: https://www.chainlords.net/arena-3v3.html
• Mail (ops): ops@chainlords.net
• Mail (hello): hello@chainlords.net

Play URL for friends = only from #announcements when the public stack is up.
`;

const HOW_TO_PLAY = `**How to play (test)**

1. Install **Phantom** (official only): https://phantom.app/download  
2. Write seed on **paper** (never share).  
3. Wait for play link in #announcements.  
4. Connect wallet → character list → enter World.  

Issues → #bug-reports or #support.
`;

async function ensureRole(guild, def) {
  let role = guild.roles.cache.find((r) => r.name === def.name);
  if (role) {
    console.log("role exists:", def.name);
    return role;
  }
  role = await guild.roles.create({
    name: def.name,
    color: def.color,
    permissions: def.perms ?? [],
    reason: "Chain Lords bootstrap",
  });
  console.log("role created:", def.name);
  return role;
}

async function ensureCategory(guild, name, overwrites) {
  let cat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name,
  );
  if (cat) {
    console.log("category exists:", name);
    return cat;
  }
  cat = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: "Chain Lords bootstrap",
  });
  console.log("category created:", name);
  return cat;
}

async function ensureText(guild, parent, ch, overwrites) {
  const existing = guild.channels.cache.find(
    (c) => c.parentId === parent.id && c.name === ch.name,
  );
  if (existing) {
    console.log("channel exists:", ch.name);
    return existing;
  }
  const type = ch.voice ? ChannelType.GuildVoice : ChannelType.GuildText;
  const created = await guild.channels.create({
    name: ch.name,
    type,
    parent: parent.id,
    topic: ch.topic,
    permissionOverwrites: overwrites,
    reason: "Chain Lords bootstrap",
  });
  console.log("channel created:", ch.name);
  return created;
}

function staffOverwrites(guild, staffRole, modRole, everyoneId, staffOnly, staffOnlyWrite) {
  const overs = [];
  if (staffOnly) {
    overs.push({
      id: everyoneId,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    });
    overs.push({
      id: staffRole.id,
      type: OverwriteType.Role,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    });
    overs.push({
      id: modRole.id,
      type: OverwriteType.Role,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    });
    return overs;
  }
  if (staffOnlyWrite) {
    overs.push({
      id: everyoneId,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.SendMessages],
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
    });
    overs.push({
      id: staffRole.id,
      type: OverwriteType.Role,
      allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
    });
    overs.push({
      id: modRole.id,
      type: OverwriteType.Role,
      allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
    });
  }
  return overs;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    await guild.channels.fetch();

    console.log("Bootstrapping guild:", guild.name);

    const roles = {};
    for (const def of ROLES) {
      roles[def.name] = await ensureRole(guild, def);
    }

    // Put bot user in Bot role if possible
    const me = guild.members.me ?? (await guild.members.fetchMe());
    if (me && roles.Bot && !me.roles.cache.has(roles.Bot.id)) {
      await me.roles.add(roles.Bot).catch(() => {});
    }

    const everyoneId = guild.roles.everyone.id;
    const channelByName = {};

    for (const block of STRUCTURE) {
      const catOverwrites = block.staffOnly
        ? staffOverwrites(guild, roles.Staff, roles.Mod, everyoneId, true, false)
        : [];
      const cat = await ensureCategory(guild, block.category, catOverwrites);

      for (const ch of block.channels) {
        const overs = staffOverwrites(
          guild,
          roles.Staff,
          roles.Mod,
          everyoneId,
          !!block.staffOnly,
          !!ch.staffOnlyWrite,
        );
        const created = await ensureText(guild, cat, ch, overs);
        channelByName[ch.name] = created;
      }
    }

    // Seed messages (only if channel empty-ish)
    async function seed(name, content) {
      const ch = channelByName[name];
      if (!ch || !ch.isTextBased()) return;
      const msgs = await ch.messages.fetch({ limit: 5 }).catch(() => null);
      if (msgs && msgs.size > 0) {
        console.log("skip seed (not empty):", name);
        return;
      }
      const m = await ch.send({ content });
      if (ch.setTopic) {
        /* already set */
      }
      try {
        await m.pin();
      } catch {
        /* need permission */
      }
      console.log("seeded:", name);
    }

    // Resolve #mentions after create — replace placeholders with IDs
    const ann = channelByName.announcements;
    const bugs = channelByName["bug-reports"];
    let welcome = WELCOME;
    if (ann) welcome = welcome.replace("<#announcements>", `<#${ann.id}>`);
    if (bugs) welcome = welcome.replace("<#bug-reports>", `<#${bugs.id}>`);

    await seed("welcome", welcome);
    await seed("links", LINKS);
    await seed("how-to-play", HOW_TO_PLAY);
    await seed("bug-reports", BUG_TEMPLATE);

    // Permanent invite on welcome
    const welcomeCh = channelByName.welcome;
    let inviteUrl = "";
    if (welcomeCh) {
      const inv = await guild.invites.create(welcomeCh.id, {
        maxAge: 0,
        maxUses: 0,
        reason: "Chain Lords permanent invite",
      });
      inviteUrl = `https://discord.gg/${inv.code}`;
      console.log("\n=== PERMANENT INVITE ===");
      console.log(inviteUrl);
      console.log("========================\n");
    }

    console.log("Done. Next:");
    console.log("1. Give yourself Staff role (Server settings → Members)");
    console.log("2. Put invite on landing");
    console.log("3. npm start for FAQ bot when XAI_API_KEY is ready");
    if (inviteUrl) {
      console.log("4. Invite:", inviteUrl);
    }

    client.destroy();
    process.exit(0);
  } catch (err) {
    console.error(err);
    client.destroy();
    process.exit(1);
  }
});

client.login(token).catch((e) => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
