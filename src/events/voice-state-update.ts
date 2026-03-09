import * as GuildVCAnnouncer from "@lib/tts/GuildVoiceChannelAnnouncer";
import {VoiceState} from "discord.js";
import {translate} from "@lib/tts/localization/text";

export default async function voiceStateUpdateListener(
    oldState: VoiceState,
    newState: VoiceState,
) {
    // Ignoriere Bots
    if (newState.member?.user.bot) return;

    // Selbst-Mute toggle
    if (oldState.selfMute !== newState.selfMute) {
        if (newState.selfMute) {
            // User hat sich gemutet
            console.log(`${newState.member?.displayName} hat sich gemutet.`);
            // await announceSelfMuteChange(newState, true);
        } else {
            // User hat sich entmutet
            console.log(`${newState.member?.displayName} hat sich entmutet.`);
            // await announceSelfMuteChange(newState, false);
        }
    }

    GuildVCAnnouncer.handleVoiceStateUpdate(oldState, newState);
}


export async function announceSelfMuteChange(
    state: VoiceState,
    isMuted: boolean,
): Promise<void> {
    if (!state.guild.id || !state.member) return;

    const announcer = GuildVCAnnouncer.getAnnouncer(state.guild.id);
    if (!announcer) return;

    const memberName =
        state.member.nickname ?? state.member.user.displayName ?? "User";
    const textLang = GuildVCAnnouncer.getGuildTextLanguage(state.guild.id);

    const message = isMuted
        ? translate(textLang, "muted", memberName)
        : translate(textLang, "unmuted", memberName)

    announcer.languageCode =
        GuildVCAnnouncer.getGuildVoiceLanguage(state.guild.id);
    await announcer.play(message);
}