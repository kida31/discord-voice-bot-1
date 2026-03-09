import googleTTS from "google-tts-api";
import {Payload, type TTSService, type URLString} from "../tts-stuff";
import type {TTSProvider} from "@lib/tts/audio-provider/type";
import type {Subtag} from "@lib/tts/localization/lang";

type ReadSpeed = "normal" | "slow"; // TODO verify

interface GoogleTranslateProviderConfig {
    language: Subtag;
    speed: ReadSpeed
}

const DEFAULT_CONFIG = {
    language: "en",
    speed: "normal",
} as const satisfies GoogleTranslateProviderConfig;

/**
 * A concrete TTS provider for the Google Translate API TTS.
 */
export class GoogleTranslateTTS implements TTSService, TTSProvider {
    static readonly NAME = "Google TTS";
    static readonly FRIENDLY_NAME = "Google Translate TTS";

    private language: Subtag;
    private speed: ReadSpeed;

    constructor(readonly config?: Partial<GoogleTranslateProviderConfig>) {
        const {language, speed} = {
            ...DEFAULT_CONFIG,
            ...config,
        }

        this.language = language;
        this.speed = speed;
    }

    async create(
        sentence: string,
        extras: { language: Subtag; speed?: string },
    ): Promise<Payload[]> {
        return new Promise((resolve, reject) => {
            try {
                const data = googleTTS.getAllAudioUrls(sentence, {
                    lang: extras.language,
                    slow: extras.speed === "normal",
                    splitPunct: ",.?!",
                });

                resolve(
                    data.map(({url, shortText}) => {
                        return new Payload(url as URLString, shortText, GoogleTranslateTTS.NAME, extras);
                    }),
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    async toSpeech(text: string): Promise<Payload[]> {
        return this.create(text, {
            language: this.language,
            speed: this.speed,
        });
    }
}
