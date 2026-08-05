import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.members.fetch();
    const staff = guild.roles.cache.find((r) => r.name === "Staff");
    if (!staff) {
      console.error("No Staff role");
      process.exit(1);
    }
    // Owner always; also any human that isn't a bot
    const owner = await guild.fetchOwner();
    await owner.roles.add(staff);
    console.log("Staff granted to owner:", owner.user.tag);
  } catch (e) {
    console.error("Could not grant Staff (enable Server Members Intent or do it manually):", e.message);
  }
  client.destroy();
  process.exit(0);
});

client.login(token);
