import type {Guild} from "discord.js";
import {spawn} from "child_process";
import ffmpegPath from "ffmpeg-static";
import {Payload} from "../../types";
import type {BCP47} from "@lib/tts/localization/lang";
import type {VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";
import {VOICES} from "@lib/tts/audio-provider/eleven-labs/voices";
import type {TTSProvider, TTSRequestContext} from "@lib/tts/audio-provider";
import {
    getOrCreateCachedAudio,
    type TTSAudioCacheKey,
} from "@lib/tts/cache/TTSAudioCache";

if (!ffmpegPath) {
    throw new Error(
        "ffmpeg-static did not provide an FFmpeg binary",
    );
}

const FFMPEG_PATH: string = ffmpegPath;

type ElevenVoiceSettings = {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
};

const DEFAULT_VOICE_ID =
    VOICES.english_female.id;

/* ============================================================== */

export class ElevenLabsProvider implements TTSProvider {
    static NAME = "ElevenLabs";

    static FRIENDLY_NAME =
        "ElevenLabs Text-to-Speech Provider";

    static EXTRA_FIELDS = [
        "language",
        "model",
        "voiceId",
        "stability",
        "similarityBoost",
        "style",
        "speakerBoost",
        "outputFormat",
    ] as const;

    static EXTRA_DEFAULTS = {
        language: "en-US" satisfies BCP47 as BCP47,
        model: "eleven_v4_turbo",
        voiceId: DEFAULT_VOICE_ID,
        stability: 0.6,
        similarityBoost: 0.9,
        style: 0.3,
        speakerBoost: true,
        outputFormat: "opus_48000_128",
    };

    private apiKey: string;
    private language_code?: BCP47;
    private voiceId: VoiceId;

    constructor(config?: {
        apiKey?: string;
        language_code?: BCP47;
        voiceId?: VoiceId;
    }) {
        this.apiKey =
            config?.apiKey ??
            process.env["ELEVENLABS_API_KEY"] ??
            "";

        if (!this.apiKey) {
            throw new Error(
                "Missing ELEVENLABS_API_KEY",
            );
        }

        this.language_code =
            config?.language_code ??
            ElevenLabsProvider.EXTRA_DEFAULTS.language;

        this.voiceId =
            config?.voiceId ??
            DEFAULT_VOICE_ID;
    }

    private static looksLikeOgg(
        buffer: Uint8Array,
    ): boolean {
        return (
            buffer.length >= 4 &&
            buffer[0] === 0x4f &&
            buffer[1] === 0x67 &&
            buffer[2] === 0x67 &&
            buffer[3] === 0x53
        );
    }

    private static looksLikeMp3(
        buffer: Uint8Array,
    ): boolean {
        if (buffer.length < 3) {
            return false;
        }

        if (buffer[1] === undefined) {
            return false;
        }

        const hasId3Header =
            buffer[0] === 0x49 &&
            buffer[1] === 0x44 &&
            buffer[2] === 0x33;

        const hasFrameSync =
            buffer[0] === 0xff &&
            (buffer[1] & 0xe0) === 0xe0;

        return hasId3Header || hasFrameSync;
    }

    private static runFFmpeg(
        input: Buffer,
        args: string[],
    ): Promise<Buffer> {
        return new Promise(
            (resolve, reject) => {
                const process = spawn(
                    FFMPEG_PATH,
                    args,
                    {
                        stdio: [
                            "pipe",
                            "pipe",
                            "pipe",
                        ],
                    },
                );

                const outputChunks: Buffer[] = [];
                const errorChunks: Buffer[] = [];

                process.stdout.on(
                    "data",
                    (chunk: Buffer) => {
                        outputChunks.push(chunk);
                    },
                );

                process.stderr.on(
                    "data",
                    (chunk: Buffer) => {
                        errorChunks.push(chunk);
                    },
                );

                process.on(
                    "error",
                    (error) => {
                        reject(error);
                    },
                );

                process.on(
                    "close",
                    (exitCode) => {
                        const stderr =
                            Buffer.concat(
                                errorChunks,
                            ).toString();

                        if (exitCode !== 0) {
                            reject(
                                new Error(
                                    `FFmpeg exited with code `
                                    + `${exitCode}: ${stderr}`,
                                ),
                            );

                            return;
                        }

                        const output =
                            Buffer.concat(
                                outputChunks,
                            );

                        if (output.length === 0) {
                            reject(
                                new Error(
                                    "FFmpeg produced an empty output",
                                ),
                            );

                            return;
                        }

                        resolve(output);
                    },
                );

                process.stdin.on(
                    "error",
                    (error) => {
                        reject(error);
                    },
                );

                process.stdin.end(input);
            },
        );
    }

    private async requestAudio(
        sentence: string,
        options: {
            languageCode?: BCP47;
            model: string;
            outputFormat: string;
            voiceId: VoiceId;
            voiceSettings: ElevenVoiceSettings;
        },
    ): Promise<Buffer> {
        const {
            languageCode,
            model,
            outputFormat,
            voiceId,
            voiceSettings,
        } = options;

        const url =
            `https://api.elevenlabs.io/v1/text-to-speech/`
            + `${voiceId}`
            + `?output_format=`
            + `${encodeURIComponent(outputFormat)}`;

        const body = {
            text: sentence,
            model_id: model,
            voice_settings: voiceSettings,
            ...(languageCode
                ? {language_code: languageCode}
                : {}),
        };

        const response = await fetch(
            url,
            {
                method: "POST",
                headers: {
                    "xi-api-key": this.apiKey,
                    "Content-Type":
                        "application/json",
                    "Accept": "*/*",
                },
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const responseText =
                await response
                    .text()
                    .catch(() => "");

            throw new Error(
                `ElevenLabs TTS failed: `
                + `HTTP ${response.status} - `
                + responseText,
            );
        }

        const contentType =
            response.headers.get(
                "content-type",
            ) ?? "";

        console.log(
            `[ElevenLabs] requested output format: `
            + `${outputFormat}`,
        );

        console.log(
            `[ElevenLabs] content-type: `
            + `${contentType}`,
        );

        const audio = Buffer.from(
            await response.arrayBuffer(),
        );

        if (audio.length === 0) {
            throw new Error(
                "ElevenLabs returned empty audio",
            );
        }

        /*
         * ElevenLabs normally returns an Ogg container when
         * opus_48000_* is requested. This is already suitable
         * for Discord and requires no transcoding.
         */
        if (
            ElevenLabsProvider.looksLikeOgg(
                audio,
            )
        ) {
            return audio;
        }

        const isMp3 =
            ElevenLabsProvider.looksLikeMp3(
                audio,
            );

        const expectedOpus =
            outputFormat.startsWith(
                "opus_48000",
            );

        console.warn(
            `[ElevenLabs] Expected Ogg/Opus but received `
            + `${contentType || "an unknown format"}. `
            + `Using FFmpeg fallback.`,
        );

        const remuxArgs = [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-f",
            "ogg",
            "-c:a",
            "copy",
            "pipe:1",
        ];

        const transcodeArgs = [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-f",
            "ogg",
            "-c:a",
            "libopus",
            "-b:a",
            "128k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "pipe:1",
        ];

        if (
            expectedOpus &&
            !isMp3 &&
            !contentType.includes("mpeg")
        ) {
            try {
                return await ElevenLabsProvider
                    .runFFmpeg(
                        audio,
                        remuxArgs,
                    );
            } catch (error) {
                console.warn(
                    "[FFmpeg] Remux failed; "
                    + "retrying with Opus transcoding.",
                    error,
                );
            }
        }

        return ElevenLabsProvider.runFFmpeg(
            audio,
            transcodeArgs,
        );
    }

    async createAudio(
        sentence: string,
        extras =
            ElevenLabsProvider.EXTRA_DEFAULTS,
        context?: TTSRequestContext,
    ): Promise<Payload[]> {
        const languageCode =
            this.language_code;

        const {
            model,
            outputFormat,
            stability,
            similarityBoost,
            style,
            speakerBoost,
        } = {
            ...ElevenLabsProvider.EXTRA_DEFAULTS,
            ...extras,
        };

        const voiceId = this.voiceId;

        const voiceSettings: ElevenVoiceSettings = {
            stability,
            similarity_boost:
                similarityBoost,
            style,
            use_speaker_boost:
                speakerBoost,
        };

        const cacheKey: TTSAudioCacheKey = {
            provider:
                ElevenLabsProvider.NAME,
            sentence,
            voiceId,
            model,
            outputFormat,
            stability,
            similarityBoost,
            style,
            speakerBoost,
            ...(languageCode !== undefined
                ? {language: languageCode}
                : {}),
        };

        const cachedAudio =
            await getOrCreateCachedAudio(
                cacheKey,
                () =>
                    this.requestAudio(
                        sentence,
                        {
                            ...(languageCode !==
                            undefined
                                ? {
                                    languageCode,
                                }
                                : {}),
                            model,
                            outputFormat,
                            voiceId,
                            voiceSettings,
                        },
                    ),
                "ogg",
                context,
            );

        return [
            new Payload(
                cachedAudio.path,
                sentence,
                ElevenLabsProvider.NAME,
                {
                    ...extras,
                    language: languageCode,
                    model,
                    voiceId,
                    outputFormat,
                    container: "ogg",
                    codec: "opus",
                    cacheHit:
                        cachedAudio.hit,
                    note: cachedAudio.hit
                        ? "TTS cache hit"
                        : "TTS cache miss",
                },
            ),
        ];
    }

    getPlayLogMessage(
        payload: Payload,
        guild: Guild,
    ) {
        const {
            sentence,
            extras: {
                language,
                model,
                voiceId,
                outputFormat,
                container,
                codec,
                note,
            },
        } = payload;

        return (
            `(ElevenLabs): Saying `
            + `"${sentence}" with model ${model} `
            + `(${language}, voiceId: ${voiceId}, `
            + `${outputFormat}, ${container}/`
            + `${codec}${note ? ", " + note : ""}) `
            + `in guild ${guild.name}.`
        );
    }
}

export default ElevenLabsProvider;