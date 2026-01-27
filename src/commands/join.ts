import type { ChatCommand } from "@commands/type";
import {
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { createTTSPlayer } from "classes/GuildVoiceChannelAnnouncer";
import {
  CommandInteraction,
  DiscordAPIError,
  SlashCommandBuilder,
  type VoiceBasedChannel,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join user's voice channel"),
  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      return;
    }

    const itxChannel = interaction.channel;
    if (itxChannel?.isVoiceBased()) {
      return _joinVoiceChannel(interaction, itxChannel);
    }

    const guild = interaction.guild;
    const vm = guild?.voiceStates;
    try {
      const userVoiceState = await vm?.fetch(interaction.user);
      const userVoiceChannel = userVoiceState?.channel;
      if (userVoiceChannel) {
        return _joinVoiceChannel(interaction, userVoiceChannel);
      }
    } catch (e) {
      console.warn("Something went wrong");
      if (e instanceof DiscordAPIError) {
        console.error(e);
      } else {
        console.error(e);
      }
    }
  },
} satisfies ChatCommand;

async function _joinVoiceChannel(
  itx: CommandInteraction,
  channel: VoiceBasedChannel,
): Promise<void> {
  // TODO

  console.log("Bot is trying to join", channel.name);

  const announcer = createTTSPlayer(channel.guild, channel);

  const connection = announcer.connection!;

  connection.on(
    VoiceConnectionStatus.Disconnected,
    async (_oldState, _newState) => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        console.log("I think I got kicked out");
        // Seems to be reconnecting to a new channel - ignore disconnect
      } catch {
        // Seems to be a real disconnect which SHOULDN'T be recovered from
        console.log("I think I got kicked out");
        connection.destroy();
      }
    },
  );
}
