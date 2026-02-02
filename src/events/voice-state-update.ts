import * as GuildVCAnnouncer from "@lib/tts/GuildVoiceChannelAnnouncer";
import { VoiceState } from "discord.js";

export default async function voiceStateUpdateListener(
  oldState: VoiceState,
  newState: VoiceState,
) {
  GuildVCAnnouncer.handleVoiceStateUpdate(oldState, newState);
}
