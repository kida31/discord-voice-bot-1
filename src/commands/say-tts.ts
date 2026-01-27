import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import type { ChatCommand } from "./type";
import { getAnnouncer } from "classes/GuildVoiceChannelAnnouncer";

// import ffmpeg from "ffmpeg-static";
// console.log("Using FFmpeg at:", ffmpeg);
const data = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Say something with tts")
  .addStringOption((option) =>
    option.setName("text").setDescription("Say something").setRequired(true),
  );

async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const text = interaction.options.getString("text", true);

  if (!interaction.guildId) return;

  const announcer = getAnnouncer(interaction.guildId);

  if (!announcer) {
    return;
  }

  announcer.play(text);
}

export default {
  data,
  execute,
  run: execute,
} satisfies ChatCommand;
