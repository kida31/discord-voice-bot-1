import type {Guild} from "discord.js";
import {PassThrough, Readable} from "stream";
import {spawn} from "child_process";
import {Payload} from "../../types";
import type {BCP47} from "@lib/tts/localization/lang";
import type {VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";
import { VOICES} from "@lib/tts/audio-provider/eleven-labs/voices";
import type {TTSProvider} from "@lib/tts/audio-provider";

type ElevenVoiceSettings = {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
};

const DEFAULT_VOICE_ID = VOICES.english_female.id; // english voices as default fallback

/* ============================================================== */

export class ElevenLabsProvider implements TTSProvider {
    static NAME = "ElevenLabs";
    static FRIENDLY_NAME = "ElevenLabs Text-to-Speech Provider";

    static EXTRA_FIELDS = [
        "language", "model", "voiceId",
        "stability", "similarityBoost", "style", "speakerBoost",
        "outputFormat"
    ] as const;

    static EXTRA_DEFAULTS = {
        language: "en-US" satisfies BCP47 as BCP47,
        model: "eleven_turbo_v2_5", //alternative "eleven_multilingual_v2" but VN not working with it 
        voiceId: DEFAULT_VOICE_ID,
        stability: 0.6, // 0.0 (more random) bis 1.0 (more stable)
        similarityBoost: 0.9, // 0.0 (less similar) bis 1.0 (more similar)
        style: 0.3, // 0.0 (neutral) bis 1.0 (more style, e.g. emotional)
        speakerBoost: true,
        outputFormat: "opus_48000_128",
    };

    private apiKey: string;
    private language_code?: BCP47;
    private voiceId: VoiceId;

    constructor(config?: {
        apiKey?: string;
        language_code?: BCP47
        voiceId?: VoiceId;
    }) {
        this.apiKey = config?.apiKey ?? process.env["ELEVENLABS_API_KEY"] ?? "";
        if (!this.apiKey) {
            throw new Error("Missing ELEVENLABS_API_KEY");
        }

        this.language_code = config?.language_code ?? ElevenLabsProvider.EXTRA_DEFAULTS.language;
        this.voiceId = config?.voiceId ?? DEFAULT_VOICE_ID;
    }

    private static looksLikeOgg(buf: Uint8Array): boolean {
        return buf.length >= 4 &&
            buf[0] === 0x4F &&
            buf[1] === 0x67 &&
            buf[2] === 0x67 &&
            buf[3] === 0x53;
    }

    private static looksLikeMp3(buf: Uint8Array): boolean {
        if (buf.length < 3) return false;
        if (buf[1] === undefined) return false; // k added this: is this correct?

        const id3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
        const frameSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
        return id3 || frameSync;
    }

    async createAudio(
        sentence: string,
        extras = ElevenLabsProvider.EXTRA_DEFAULTS
    ): Promise<Payload[]> {
        const language_code = this.language_code;

        const {model, outputFormat} = {
            ...ElevenLabsProvider.EXTRA_DEFAULTS,
            ...extras,
        };

        const voiceId = this.voiceId;

        const voice_settings: ElevenVoiceSettings = {
            stability: extras.stability ?? 0.6,
            similarity_boost: extras.similarityBoost ?? 0.9,
            style: extras.style ?? 0.3,
            use_speaker_boost: extras.speakerBoost ?? true,
        };

        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        const body = {
            text: sentence,
            model_id: model,
            voice_settings,
            output_format: outputFormat,
            ...(language_code ? {language_code} : {}),
        };

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "xi-api-key": this.apiKey,
                "Content-Type": "application/json",
                "Accept": "*/*",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
            const text = await res.text().catch(() => "");
            throw new Error(`ElevenLabs TTS failed: HTTP ${res.status} – ${text}`);
        }

        const contentType = res.headers.get("content-type") ?? "";
        console.log(`[ElevenLabs] content-type: ${contentType}`);

        const reader = res.body.getReader();
        const peekChunks: Uint8Array[] = [];
        let received = 0;

        while (received < 65536) {
            const {value, done} = await reader.read();
            if (done) break;
            if (value) {
                peekChunks.push(value);
                received += value.length;
                if (received >= 4) break;
            }
        }

        const first = peekChunks[0] ?? new Uint8Array(0);
        const isOgg = ElevenLabsProvider.looksLikeOgg(first);
        const isMp3 = ElevenLabsProvider.looksLikeMp3(first);
        const expectedOpus = outputFormat.startsWith("opus_48000");

        if (isOgg) {
            const pass = new PassThrough();
            for (const c of peekChunks) pass.write(Buffer.from(c));

            (async () => {
                for (; ;) {
                    const {value, done} = await reader.read();
                    if (done) break;
                    if (value) pass.write(Buffer.from(value));
                }
                pass.end();
            })();

            return [
                new Payload(
                    pass as unknown as Readable,
                    sentence,
                    ElevenLabsProvider.NAME,
                    {
                        ...extras,
                        language: language_code,
                        model,
                        voiceId,
                        container: "ogg",
                        codec: "opus",
                        note: "fast-path (no ffmpeg)",
                    }
                ),
            ];
        }

        const remuxArgs = ["-i", "pipe:0", "-f", "ogg", "-c:a", "copy", "pipe:1"];
        const transcodeArgs = [
            "-i", "pipe:0",
            "-f", "ogg",
            "-c:a", "libopus",
            "-b:a", "128k",
            "-ar", "48000",
            "-ac", "2",
            "pipe:1",
        ];

        let ffmpeg = spawn(
            "ffmpeg",
            isMp3 || contentType.includes("mpeg")
                ? transcodeArgs
                : expectedOpus
                    ? remuxArgs
                    : transcodeArgs
        );

        let retried = false;

        ffmpeg.stderr.on("data", (d) => {
            const msg = d.toString();
            console.error("[FFmpeg]", msg);

            if (!retried && /Unsupported codec|Invalid argument|write header/.test(msg)) {
                retried = true;
                try {
                    ffmpeg.kill("SIGKILL");
                } catch {
                    // ignore
                }

                ffmpeg = spawn("ffmpeg", transcodeArgs);

                for (const c of peekChunks) ffmpeg.stdin.write(Buffer.from(c));

                (async () => {
                    for (; ;) {
                        const {value, done} = await reader.read();
                        if (done) break;
                        if (value) ffmpeg.stdin.write(Buffer.from(value));
                    }
                    ffmpeg.stdin.end();
                })();
            }
        });

        for (const c of peekChunks) ffmpeg.stdin.write(Buffer.from(c));

        (async () => {
            for (; ;) {
                const {value, done} = await reader.read();
                if (done) break;
                if (value) ffmpeg.stdin.write(Buffer.from(value));
            }
            ffmpeg.stdin.end();
        })();

        return [
            new Payload(
                ffmpeg.stdout as unknown as Readable,
                sentence,
                ElevenLabsProvider.NAME,
                {
                    ...extras,
                    language: language_code,
                    model,
                    voiceId,
                    container: "ogg",
                    codec: "opus",
                    note: retried
                        ? "transcoded (libopus)"
                        : isMp3
                            ? "transcoded (mp3->opus)"
                            : expectedOpus
                                ? "remux (copy)"
                                : "transcoded",
                }
            ),
        ];
    }

    getPlayLogMessage(payload: Payload, guild: Guild) {
        const {
            sentence,
            extras: {language, model, voiceId, outputFormat, container, codec, note},
        } = payload;

        return `(ElevenLabs): Saying "${sentence}" with model ${model} `
            + `(${language}, voiceId: ${voiceId}, ${outputFormat}, `
            + `${container}/${codec}${note ? ", " + note : ""}) in guild ${guild.name}.`;
    }
}

export default ElevenLabsProvider;