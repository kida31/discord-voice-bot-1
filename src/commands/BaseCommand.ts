import type {
  CacheType,
  ChatInputCommandInteraction,
  Interaction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

export interface BaseCommand<T extends Interaction<CacheType>> {
  data: Pick<SlashCommandBuilder, "toJSON">;
  run(itx: T): Promise<void>;
}

export interface ChatInputCommand extends BaseCommand<
  ChatInputCommandInteraction<CacheType>
> {
  data: SlashCommandOptionsOnlyBuilder | SlashCommandBuilder;
  //   run(itx: ChatInputCommandInteraction<CacheType>): Promise<void>;
}
