import type {
  ChatInputCommandInteraction,
  CacheType,
  // SlashCommandOptionsOnlyBuilder,
  SlashCommandBuilder,
  Interaction,
} from "discord.js";

export interface BaseCommand<T extends Interaction<CacheType>> {
  data: Pick<SlashCommandBuilder, "toJSON" | "name">;
  execute(itx: T): Promise<void>;
}

export interface ChatInputCommand extends BaseCommand<
  ChatInputCommandInteraction<CacheType>
> {
//  data: SlashCommandOptionsOnlyBuilder | SlashCommandBuilder;
  execute(itx: ChatInputCommandInteraction<CacheType>): Promise<void>;
}
