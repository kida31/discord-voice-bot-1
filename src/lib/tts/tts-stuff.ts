import type {AudioPlayer, createAudioResource, VoiceConnection} from "@discordjs/voice";
import {type Guild, type VoiceBasedChannel} from "discord.js";
import type {TTSProvider} from "@lib/tts/audio-provider";

export interface TTSPlayer {
    player: AudioPlayer;
    tts: TTSProvider;

    guild: Guild | undefined;
    channel: VoiceBasedChannel | undefined;
    connection: VoiceConnection | undefined;

    connect(options: { guild: Guild; channel: VoiceBasedChannel }): Promise<VoiceConnection>;

    play(text: string): Promise<void>;

    destroy(): void;
}

/**
 * This class represents the data that is used to run the TTSPlayer.
 */
export class Payload {
    constructor(
        public resource: Parameters<typeof createAudioResource>[0],
        public sentence: string,
        public providerName: string,
        public extras: { [key: string]: any },
    ) {
        /**
         * The readable stream or URL that points to a readable stream of the TTS message to be played.
         * @type {string|ReadableStream}
         */
        this.resource = resource;

        /**
         * The sentence that will be played for TTS.
         * @type {string}
         */
        this.sentence = sentence;

        /**
         * The name of the provider. Generally should be set to the NAME static property of any concrete provider.
         * @type {string}
         */
        this.providerName = providerName;

        /**
         * Any extra information that the payload should contain.
         * @type {object}
         */
        this.extras = extras;
    }
}
