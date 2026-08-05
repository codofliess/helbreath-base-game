/**
 * Poll until bot joins at least one guild, write GUILD_ID to .env, run setup-server.mjs
 */
import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { readFileSync, writeFileSync } from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const token = process.env.DISCORD_BOT_TOKEN?.trim();
if (!token) {
  console.error("No DISCORD_BOT_TOKEN in .env");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function setGuildIdInEnv(guildId) {
  const envPath = join(__dirname, ".env");
  let text = readFileSync(envPath, "utf8");
  if (text.match(/^DISCORD_GUILD_ID=.*$/m)) {
    text = text.replace(/^DISCORD_GUILD_ID=.*$/m, `DISCORD_GUILD_ID=${guildId}`);
  } else {
    text = `DISCORD_GUILD_ID=${guildId}\n` + text;
  }
  writeFileSync(envPath, text);
  console.log("Wrote DISCORD_GUILD_ID to .env");
}

client.once("ready", async () => {
  console.log("Bot online as", client.user?.tag);
  console.log("Waiting for invite… open the authorize URL and pick Helbreath Chain Lords.");
  console.log(
    "URL: https://discord.com/api/oauth2/authorize?client_id=1528985969838264391&permissions=8&scope=bot%20applications.commands",
  );

  const deadline = Date.now() + 10 * 60 * 1000;
  const tick = async () => {
    await client.guilds.fetch();
    const guilds = [...client.guilds.cache.values()];
    if (guilds.length > 0) {
      // Prefer name match
      let g =
        guilds.find((x) => /chain\s*lords/i.test(x.name)) ||
        guilds.find((x) => /helbreath/i.test(x.name)) ||
        guilds[0];
      console.log("Found guild:", g.name, g.id);
      setGuildIdInEnv(g.id);
      client.destroy();

      console.log("Running setup-server.mjs …");
      const child = spawn(process.execPath, ["setup-server.mjs"], {
        cwd: __dirname,
        stdio: "inherit",
        env: { ...process.env, DISCORD_GUILD_ID: g.id },
      });
      child.on("exit", (code) => process.exit(code ?? 1));
      return;
    }
    if (Date.now() > deadline) {
      console.error("Timeout 10 min: bot still in 0 servers. Authorize the invite URL first.");
      client.destroy();
      process.exit(1);
    }
    process.stdout.write(".");
    setTimeout(tick, 4000);
  };
  tick();
});

client.login(token).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
