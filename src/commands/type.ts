import type {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

export interface ChatCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute(args: ChatInputCommandInteraction): Promise<void>;
}
