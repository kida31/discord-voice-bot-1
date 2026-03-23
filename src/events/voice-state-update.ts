import {handleVoiceStateUpdate as handleTTS} from "@lib/tts";
import {VoiceState} from "discord.js";

async function voiceStateUpdateListener(
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

    handleTTS(oldState, newState);
}

export default voiceStateUpdateListener;