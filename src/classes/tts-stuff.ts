import type { AudioPlayer, VoiceConnection } from "@discordjs/voice";
import { Collection, type Guild, type VoiceBasedChannel } from "discord.js";

export type LanguageCode = "en" | "vi-VN";

const icons: Collection<LanguageCode, string> = new Collection();
icons.set("en", "Announcer");
icons.set("vi-VN", "VTV4 Announcer");

export function getNickname(l: LanguageCode): string {
  return icons.get(l)!;
}

export interface TTSPlayer {
  player: AudioPlayer;
  tts: TTSService;

  guild: Guild | undefined;
  channel: VoiceBasedChannel | undefined;
  connection: VoiceConnection | undefined;

  languageCode: LanguageCode;

  connect(options: { guild: Guild; channel: VoiceBasedChannel }): Promise<any>;
  play(text: string): Promise<void>;
  destroy(): void;
}

export interface TTSService {
  create(str: string, options?: { [key: string]: any }): Promise<Payload[]>;
}

/**
 * This class represents the data that is used to run the TTSPlayer.
 */
export class Payload {
  constructor(
    public resource: ReadableStream,
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
