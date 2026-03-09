import googleTTS from "google-tts-api";
import {Payload} from "../tts-stuff";
import type {TTSProvider} from "@lib/tts/audio-provider/type";
import type {Subtag} from "@lib/tts/localization/lang";

interface GoogleTranslateProviderConfig {
    language: Subtag;
    slow: boolean;
}

const DEFAULT_CONFIG = {
    language: "en",
    slow: false,
} as const satisfies GoogleTranslateProviderConfig;

/**
 * A concrete TTS provider for the Google Translate API TTS.
 */
export class GoogleTranslateTTS implements TTSProvider {
    static readonly NAME = "Google TTS";
    static readonly FRIENDLY_NAME = "Google Translate TTS";

    private readonly language: Subtag;
    private readonly slow: boolean;

    constructor(readonly config?: Partial<GoogleTranslateProviderConfig>) {
        const {language, slow} = {
            ...DEFAULT_CONFIG,
            ...config,
        }
        console.log(`[GoogleTranslateTTS] Initialized with config:`, {language, slow});
        this.language = language;
        this.slow = slow;
    }

    async toSpeech(text: string): Promise<Payload[]> {
        console.log(`[GoogleTranslateTTS] toSpeech with config:`, this.language, this.slow);
        return new Promise((resolve, reject) => {
            try {
                const data = googleTTS.getAllAudioUrls(text, {
                    lang: this.language,
                    slow: this.slow,
                    splitPunct: ",.?!",
                });

                resolve(
                    data.map(({url, shortText}) => {
                        return new Payload(
                            url,
                            shortText,
                            GoogleTranslateTTS.NAME,
                            {
                                language: this.language,
                                speed: this.slow ? "slow" : "normal",
                            });
                    }),
                );
            } catch (error) {
                reject(error);
            }
        });
    }
}
