import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getNickname, type LanguageCode } from "@lib/tts/tts-stuff";
import type { ChatInputCommand } from "./type";
import {
  setGuildTextLanguage,
  setGuildVoiceLanguage,
} from "@lib/tts/GuildVoiceChannelAnnouncer";

const languageOptions: { name: string; value: LanguageCode }[] = [
  { name: "Vietnamese", value: "vi-VN" },
  { name: "English", value: "en" },
  { name: "Deutsch (German)", value: "de-DE" },
] as const;

const data = new SlashCommandBuilder()
  .setName("language")
  .setDescription("Set language for TTS player")
  .addSubcommand((sc) =>
    sc
      .setName("voice")
      .setDescription("Set language for tts voie")
      .addStringOption((option) =>
        option
          .setName("lang")
          .setDescription("Language")
          .setRequired(true)
          .addChoices(...languageOptions),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName("text")
      .setDescription("Set language for tts text")
      .addStringOption((option) =>
        option
          .setName("lang")
          .setDescription("Language")
          .setRequired(true)
          .addChoices(...languageOptions),
      ),
  );

async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guildId) return;

  const langCode = interaction.options.getString("lang", true) as LanguageCode;
  const subcommand = interaction.options.getSubcommand(true);

  if (subcommand == "voice") {
    setGuildVoiceLanguage(interaction.guildId, langCode);
    {
      const name = getNickname(langCode);
      console.log("Trying to set nickname to...", name);
      await interaction.guild?.members.me?.setNickname(name);
    }

    await interaction.reply({
      content: "Voice language set to: `" + langCode + "`",
    });
  } else if (subcommand == "text") {
    setGuildTextLanguage(interaction.guildId, langCode);

    await interaction.reply({
      content: "Text language set to: `" + langCode + "`",
    });
  } else {
    console.error("Unknown command in 'language'>", subcommand);
  }
}

export default {
  data,
  execute,
} satisfies ChatInputCommand;
