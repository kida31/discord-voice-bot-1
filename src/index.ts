import { Client, Events, GatewayIntentBits } from "discord.js";
import { commands } from "./commands";
import { devGuildId, token } from "config";
import VoiceStateUpdateHandler from "@events/voice-state-update";
import { subscribeToGuild } from "classes/GuildVoiceChannelAnnouncer";

function main() {
  // Module setup
  subscribeToGuild(devGuildId);

  // Create a new client instance
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  // When the client is ready, run this code (only once)
  client.once("clientReady", async () => {
    await client.user?.setUsername("K2");
    await (await client.guilds.fetch())
      .filter((g) => g.id == devGuildId)
      .map((g) => g.fetch().then((g) => g.members.me?.setNickname("K2")));

    console.log(`\nReady! Logged in as ${client.user?.tag}\n`);
  });

  // Login to Discord with your client's token
  client.login(token);

  client.on("messageCreate", (message) => {
    if (message.content === "!ping") {
      message.reply("Pong!");
    }
  });

  client.on("error", (error) => {
    console.error("Discord client error:", error);
  });

  client.on(Events.InteractionCreate, function (itx) {
    if (!itx.isChatInputCommand()) return;

    const cmd = commands.get(itx.commandName);
    if (!cmd) return;

    console.log(itx.user.username, "triggered", cmd?.data.name);
    cmd?.execute(itx);
  });

  client.on(VoiceStateUpdateHandler.event, VoiceStateUpdateHandler.listener);
}

main();
