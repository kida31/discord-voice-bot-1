import type {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

export interface ChatCommand {
  data: SlashCommandBuilder;
  execute(args: ChatInputCommandInteraction): Promise<void>;
}
