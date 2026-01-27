import { getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import * as GuildVCAnnouncer from "classes/GuildVoiceChannelAnnouncer";
import { Events, Guild, VoiceState, type ClientEvents } from "discord.js";
type a = ClientEvents[Events.VoiceStateUpdate];

// export const VoiceStateUpdateHandler = {
export default {
  event: Events.VoiceStateUpdate,
  async listener(oldState: VoiceState, newState: VoiceState) {
    GuildVCAnnouncer.handleVoiceStateUpdate(oldState, newState);
  },
} as const;
