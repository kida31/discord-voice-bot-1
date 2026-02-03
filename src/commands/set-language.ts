import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { setGuildVoiceLanguage } from "@lib/tts/GuildVoiceChannelAnnouncer";
import { getNickname, type LanguageCode } from "@lib/tts/tts-stuff";
import type { ChatInputCommand } from "./type";

const languageOptions: { name: string; value: LanguageCode }[] = [
  { name: "Vietnamese", value: "vi-VN" },
  { name: "English", value: "en" },
  { name: "Deutsch (German)", value: "de-DE" },
] as const;

const data = new SlashCommandBuilder()
  .setName("voice")
  .setDescription("Set voice language for TTS player")
  .addStringOption((option) =>
    option
      .setName("lang")
      .setDescription("Say something")
      .setRequired(true)
      .addChoices(...languageOptions),
  );

async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  interaction.command;

  const langCode = interaction.options.getString("lang", true) as LanguageCode;

  if (!interaction.guildId) return;

  setGuildVoiceLanguage(interaction.guildId, langCode);

  {
    const name = getNickname(langCode);
    console.log("Trying to set nickname to...", name);
    await interaction.guild?.members.me?.setNickname(name);
  }

  await interaction.reply({
    content: "Voice language set to: `" + langCode + "`",
  });
}

export default {
  data,
  execute,
} satisfies ChatInputCommand;
