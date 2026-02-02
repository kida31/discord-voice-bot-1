import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommand } from "./type";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong"),
  async execute(interaction: CommandInteraction) {
    await interaction.reply("Pong!");
  },
} satisfies ChatInputCommand;
