import googleTTS from "google-tts-api";
import {type LanguageCode, Payload, type TTSService} from "../tts-stuff";
import type {TTSProvider} from "@lib/tts/audio-provider/type";

// TODO verify
type SupportedLanguage = Extract<LanguageCode, "en-US">;
type ReadSpeed = "normal"

interface GoogleTranslateProviderConfig {
    language: SupportedLanguage;
    speed: ReadSpeed;
}

const DEFAULT_CONFIG = {
    language: "en-US",
    speed: "normal",
} as const satisfies GoogleTranslateProviderConfig;

/**
 * A concrete TTS provider for the Google Translate API TTS.
 */
export class GoogleTranslateTTS implements TTSService, TTSProvider {
    static readonly NAME = "Google TTS";
    static readonly FRIENDLY_NAME = "Google Translate TTS";

    language: SupportedLanguage;
    speed: ReadSpeed;

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
        extras: { language: LanguageCode; speed?: string },
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
                        return new Payload(url, shortText, GoogleTranslateTTS.NAME, extras);
                    }),
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    async synthesize(text: string): Promise<Payload[]> {
        return this.create(text, {
            language: this.language,
            speed: this.speed,
        });
    }
}
