import type { AudioPlayer, VoiceConnection } from "@discordjs/voice";
import { Collection, type Guild, type VoiceBasedChannel } from "discord.js";

// https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
export type LanguageCode = "en-US" | "vi-VN" | "de-DE" | "ja-JP" | "ko-KR" | "de-CH";

const botNickname: Collection<LanguageCode, string> = new Collection();
botNickname.set("en-US", "Announcer");
botNickname.set("vi-VN", "VTV4 Announcer");
botNickname.set("de-DE", "BRD Sprecher");
botNickname.set("ja-JP", "日本語アナウンサー");
botNickname.set("ko-KR", "아나운서");
botNickname.set("de-CH", "Ballerina Cappuccina");

export function getNickname(l: LanguageCode): string {
  return botNickname.get(l) ?? botNickname.get("en-US")!;
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
