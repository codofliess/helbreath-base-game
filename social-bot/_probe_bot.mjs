import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
if (!token) {
  console.error("NO_TOKEN");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("ready", async () => {
  console.log("BOT_OK", client.user?.tag);
  const guilds = [...client.guilds.cache.values()];
  console.log("GUILD_COUNT", guilds.length);
  for (const g of guilds) {
    console.log("GUILD", g.id, g.name);
  }
  const want = process.env.DISCORD_GUILD_ID?.trim();
  if (want) {
    const g = guilds.find((x) => x.id === want);
    console.log(g ? "GUILD_ID_MATCH" : "GUILD_ID_NOT_IN_BOT");
  }
  client.destroy();
  process.exit(0);
});
client.login(token).catch((e) => {
  console.error("LOGIN_FAIL", e.message);
  process.exit(1);
});
