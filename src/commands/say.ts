import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getAnnouncer } from "@lib/tts/GuildVoiceChannelAnnouncer";
import type { ChatInputCommand } from "./type";

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

  await announcer.play(text);
  const res = await interaction.reply("...playing");
  // await res.delete();
}

export default {
  data,
  execute,
} satisfies ChatInputCommand;
