import { setReadChannel } from "classes/tts/SpokenChannel";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { channel } from "node:diagnostics_channel";

export default {
  data: new SlashCommandBuilder()
    .setName("ttschannel")
    .setDescription(
      "Set current channel as verbose/spoken channel for TTS bot",
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel) return;

    const guild = await interaction.guild.fetch();
    const guildChannels = await guild.channels.fetch();
    const targetChannel = guildChannels.find(
      (c) => c?.id == interaction.channelId,
    );

    if (targetChannel?.isTextBased()) {
      setReadChannel(targetChannel);
      console.log(`Set ${guild.name}:${targetChannel.name} as TTS channel`);
    } else {
      console.warn("Unexpected channel: ", interaction.channel);
    }
  },
};
