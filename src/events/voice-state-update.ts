import { VoiceState } from "discord.js";

export default async function voiceStateUpdateListener(
  oldState: VoiceState,
  newState: VoiceState,
) {
  // Ignoriere Bots (optional)
  if (newState.member?.user.bot) return;

  // Selbst-Mute toggle
  if (oldState.selfMute !== newState.selfMute) {
    if (newState.selfMute) {
      // User hat sich gemutet
      console.log(`${newState.member?.displayName} hat sich gemutet.`);
      // Dein Event/Handler:
      // GuildVCAnnouncer.handleSelfMute(newState);
    } else {
      // User hat sich entmutet
      console.log(`${newState.member?.displayName} hat sich entmutet.`);
      // GuildVCAnnouncer.handleSelfUnmute(newState);
    }
  }
}
