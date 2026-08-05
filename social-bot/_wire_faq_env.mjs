import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
if (!token || !guildId) {
  console.error("Need DISCORD_BOT_TOKEN + DISCORD_GUILD_ID");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function setEnv(key, value) {
  const envPath = join(__dirname, ".env");
  let text = readFileSync(envPath, "utf8");
  const line = `${key}=${value}`;
  if (text.match(new RegExp(`^${key}=.*$`, "m"))) {
    text = text.replace(new RegExp(`^${key}=.*$`, "m"), line);
  } else {
    text = text.trimEnd() + `\n${line}\n`;
  }
  writeFileSync(envPath, text);
  console.log("SET", key, value);
}

client.once("ready", async () => {
  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();
  const byName = {};
  for (const ch of guild.channels.cache.values()) {
    byName[ch.name] = ch.id;
  }
  console.log("channels", Object.keys(byName).join(", "));

  const support = byName.support;
  const opsLog = byName["ops-bot-log"];
  if (!support) {
    console.error("No #support channel");
    process.exit(1);
  }

  setEnv("DISCORD_SUPPORT_CHANNEL_IDS", support);
  if (opsLog) setEnv("DISCORD_OPS_LOG_CHANNEL_ID", opsLog);
  setEnv("OFFICIAL_DISCORD_URL", "https://discord.gg/F4NwwbfKtj");
  setEnv("OFFICIAL_PLAY_URL", "https://www.chainlords.net");
  // Keep X placeholder until they have an official account
  if (!process.env.OFFICIAL_X_URL || process.env.OFFICIAL_X_URL.includes("example")) {
    setEnv("OFFICIAL_X_URL", "https://www.chainlords.net");
  }

  const xai = process.env.XAI_API_KEY?.trim();
  console.log("XAI_API_KEY", xai && xai.length > 8 ? "SET" : "MISSING");

  client.destroy();
  process.exit(0);
});

client.login(token);
