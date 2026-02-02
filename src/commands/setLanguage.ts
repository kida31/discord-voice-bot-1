import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import type { ChatCommand } from "./type";
import { setLang } from "classes/GuildVoiceChannelAnnouncer";
import { getNickname, type LanguageCode } from "classes/tts-stuff";

const languageOptions: { name: string; value: LanguageCode }[] = [
  { name: "Vietnamese", value: "vi-VN" },
  { name: "English", value: "en" },
  { name: "Deutsch (German)", value: "de-DE" },
];

const data = new SlashCommandBuilder()
  .setName("language")
  .setDescription("Set language for TTS player")
  .addStringOption((option) =>
    option
      .setName("lang")
      .setDescription("Say something")
      .setRequired(true)
      .addChoices(...languageOptions),
  );

async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const langCode = interaction.options.getString("lang", true) as LanguageCode;

  if (!interaction.guildId) return;

  setLang(interaction.guildId, langCode);

  const name = getNickname(langCode);
  console.log("Trying to set nickname to...", name);
  await interaction.guild?.members.me?.setNickname(name);
  interaction.reply(":white_check_mark:");
}

export default {
  data,
  execute,
  run: execute,
} satisfies ChatCommand;
