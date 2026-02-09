import type { Guild } from "discord.js";
import { Readable, PassThrough } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

type ElevenVoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
};

/* =======================================================
   Language → Voice Mapping
   ======================================================= */

const VOICE_BY_LANGUAGE: Record<string, string> = {
  "en-US": "eVItLK1UvXctxuaRV2Oq", // English male voice (qxTFXDYbGcR8GaHSjczg) / English female voice (eVItLK1UvXctxuaRV2Oq) 
  "en": "eVItLK1UvXctxuaRV2Oq",
  "de-DE": "xLCJR8xcZX2YjImGFyGw", // German voice (xLCJR8xcZX2YjImGFyGw) Oli: fQV5Nz63N4V4PWc9zMpt
  "de": "xLCJR8xcZX2YjImGFyGw",
  "ja-JP": "ngvNHfiCrXLPAHcTrZK1",
  "ja": "ngvNHfiCrXLPAHcTrZK1",
  "vn-VN": "a3AkyqGG4v8Pg7SWQ0Y3",
  "vn": "a3AkyqGG4v8Pg7SWQ0Y3",
  "ko-KR": "XJ2fW4ybq7HouelYYGcL",
  "ko": "XJ2fW4ybq7HouelYYGcL",
  "es-ES": "fQV5Nz63N4V4PWc9zMpt", // Brazilian Portuguese voice (ZtXh8n9l7sL1v2m5o3qJ)
  "es": "fQV5Nz63N4V4PWc9zMpt",
};

const DEFAULT_VOICE_ID = "eVItLK1UvXctxuaRV2Oq"; // english voices as default fallback

function toBaseLang(tag?: string): string | undefined {
  if (!tag) return undefined;
  const m = tag.match(/^([a-z]{2,3})(?:-[A-Z]{2})?$/);
  return m ? m[1] : undefined;
}

function normalizeLangTag(lang?: string): string | undefined {
  if (!lang) return undefined;
  if (/^[a-z]{2,3}$/.test(lang)) {
    const defaults: Record<string, string> = {
      en: "en-US",
      de: "de-DE",
      ja: "ja-JP",
      vn: "vn-VN",
      ko: "ko-KR",
    };
    return defaults[lang] || lang;
  }
  return lang;
}

function pickVoiceIdByLanguage(lang?: string): string {
  if (!lang) return DEFAULT_VOICE_ID;
  if (VOICE_BY_LANGUAGE[lang]) return VOICE_BY_LANGUAGE[lang];
  const base = toBaseLang(lang);
  if (base && VOICE_BY_LANGUAGE[base]) return VOICE_BY_LANGUAGE[base];
  return DEFAULT_VOICE_ID;
}

/* ============================================================== */

export class ElevenLabsProvider implements TTSService {
  static NAME = "ElevenLabs";
  static FRIENDLY_NAME = "ElevenLabs Text-to-Speech Provider";

  static EXTRA_FIELDS = [
    "language", "model", "voiceId",
    "stability", "similarityBoost", "style", "speakerBoost",
    "outputFormat"
  ] as const;

  static EXTRA_DEFAULTS = {
    language: "en-US",
    model: "eleven_turbo_v2_5", //alternative "eleven_multilingual_v2" but VN not working with it 
    voiceId: DEFAULT_VOICE_ID,
    stability: 0.4, // 0.0 (more random) bis 1.0 (more stable)
    similarityBoost: 0.65, // 0.0 (less similar) bis 1.0 (more similar)
    style: 0.3, // 0.0 (neutral) bis 1.0 (more style, e.g. emotional)
    speakerBoost: true,
    outputFormat: "opus_48000_128",
  };

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("Missing ELEVENLABS_API_KEY");
    }
  }

  private static toIso639_1(langTag?: string): string | undefined {
    if (!langTag) return undefined;
    const m = langTag.match(/^([a-z]{2,3})-[A-Z]{2}$/);
    return m ? m[1] : undefined;
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
    const id3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
    const frameSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
    return id3 || frameSync;
  }

  async create(
    sentence: string,
    extras = ElevenLabsProvider.EXTRA_DEFAULTS
  ): Promise<Payload[]> {

    const langTag = normalizeLangTag(extras.language || "en-US");
    const language_code = ElevenLabsProvider.toIso639_1(langTag);

    const model = extras.model || ElevenLabsProvider.EXTRA_DEFAULTS.model;
    const outputFormat = extras.outputFormat || "opus_48000_128";

    const voiceId =
      extras.voiceId ??
      pickVoiceIdByLanguage(langTag);

    const voice_settings: ElevenVoiceSettings = {
      stability: extras.stability ?? 0.5,
      similarity_boost: extras.similarityBoost ?? 0.75,
      style: extras.style ?? 0.0,
      use_speaker_boost: extras.speakerBoost ?? true,
    };

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const body = {
      text: sentence,
      model_id: model,
      voice_settings,
      output_format: outputFormat,
      ...(language_code ? { language_code } : {}),
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
      const { value, done } = await reader.read();
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
        for (;;) {
          const { value, done } = await reader.read();
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
            language: langTag,
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
        } catch {}

        ffmpeg = spawn("ffmpeg", transcodeArgs);

        for (const c of peekChunks) ffmpeg.stdin.write(Buffer.from(c));

        (async () => {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) ffmpeg.stdin.write(Buffer.from(value));
          }
          ffmpeg.stdin.end();
        })();
      }
    });

    for (const c of peekChunks) ffmpeg.stdin.write(Buffer.from(c));

    (async () => {
      for (;;) {
        const { value, done } = await reader.read();
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
          language: langTag,
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
      extras: { language, model, voiceId, outputFormat, container, codec, note },
    } = payload;

    return `(ElevenLabs): Saying "${sentence}" with model ${model} `
      + `(${language}, voiceId: ${voiceId}, ${outputFormat}, `
      + `${container}/${codec}${note ? ", " + note : ""}) in guild ${guild.name}.`;
  }
}

export default ElevenLabsProvider;