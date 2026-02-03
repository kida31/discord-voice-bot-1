import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

const NAME_OPTION = "name";

import type { ChatInputCommand } from "./type";
import { setAlias } from "@lib/tts/member-alias";
const data = new SlashCommandBuilder()
  .setName("alias")
  .setDescription("Set your spoken alias for TTS announcements")
  .addStringOption((option) =>
    option
      .setName(NAME_OPTION)
      .setDescription("Your 'pronounced' name")
      .setRequired(true),
  );

async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild() || !interaction.guild) return;
  if (!interaction.member) return;

  const alias = interaction.options.getString(NAME_OPTION, true);
  setAlias(interaction.guildId, interaction.member.user.id, alias);
  await interaction.reply({
    content: `Your TTS alias has been set to \`${alias}\``,
    flags: MessageFlags.Ephemeral,
  });
}

export default {
  data,
  execute,
} satisfies ChatInputCommand;
