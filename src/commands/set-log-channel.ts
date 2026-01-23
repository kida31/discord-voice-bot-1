import {
  ChatInputCommandInteraction,
  Collection,
  SlashCommandBuilder,
} from "discord.js";

export const guildToLogChannel = new Collection<string, string>();

export default {
  data: new SlashCommandBuilder()
    .setName("set")
    .setDescription("Set text channel for loggin")
    .addChannelOption((option) =>
      option.setName("channel").setDescription("The channel to echo into"),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel("channel");
    const guild = interaction.guild!;
    if (!channel) {
      guildToLogChannel.delete(guild.id);
      await interaction.reply("Disabled logging.");
    } else {
      guildToLogChannel.set(guild.id, channel.id);
      await interaction.reply("Set logging to " + channel.toString());
    }
  },
};
