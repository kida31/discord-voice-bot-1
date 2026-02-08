import type { Guild } from "discord.js";
import { Readable, PassThrough } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

// Node 18+ hat global fetch. Falls dein Node älter ist, entkommentiere:
// import fetch from "node-fetch";

type ElevenVoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
};

export class ElevenLabsProvider implements TTSService {
  static NAME = "ElevenLabs";
  static FRIENDLY_NAME = "ElevenLabs Text-to-Speech Provider";

  static EXTRA_FIELDS = [
    "language", "model", "voiceId",
    "stability", "similarityBoost", "style", "speakerBoost",
    "outputFormat"
  ] as const;

  static EXTRA_DEFAULTS = {
    language: "de-DE",
    model: "eleven_turbo_v2_5",          // gute Qualität bei niedriger Latenz
    voiceId: "JBFqnCBsd6RMkjVDRZzb",     // Beispiel-Voice ("George"); nimm deine eigene ID
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    speakerBoost: true,
    // Für Discord-Ziel ideal: Opus 48 kHz -> lässt sich direkt als Ogg/Opus abspielen
    outputFormat: "opus_48000_128",
  };

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("Missing ELEVENLABS_API_KEY for ElevenLabsProvider");
    }
  }

  /** "de-DE" -> "de", "en-US" -> "en" (für multilingual-Modelle optional nützlich) */
  private static toIso639_1(langTag?: string): string | undefined {
    if (!langTag) return undefined;
    const m = langTag.match(/^([a-z]{2,3})-[A-Z]{2}$/);
    return m ? m[1] : undefined;
  }

  async create(
    sentence: string,
    extras: {
      language?: string;
      model?: string;
      voiceId?: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      speakerBoost?: boolean;
      outputFormat?: string; // z.B. "opus_48000_128"
    } = ElevenLabsProvider.EXTRA_DEFAULTS
  ): Promise<Payload[]> {
    const model = extras.model || ElevenLabsProvider.EXTRA_DEFAULTS.model;
    const outputFormat = extras.outputFormat || ElevenLabsProvider.EXTRA_DEFAULTS.outputFormat;

    const langTag = extras.language || ElevenLabsProvider.EXTRA_DEFAULTS.language;
    const language_code = ElevenLabsProvider.toIso639_1(langTag);
    const voiceId = extras.voiceId || ElevenLabsProvider.EXTRA_DEFAULTS.voiceId;

    const voice_settings: ElevenVoiceSettings = {
      stability:
        typeof extras.stability === "number"
          ? extras.stability
          : ElevenLabsProvider.EXTRA_DEFAULTS.stability,
      similarity_boost:
        typeof extras.similarityBoost === "number"
          ? extras.similarityBoost
          : ElevenLabsProvider.EXTRA_DEFAULTS.similarityBoost,
      style:
        typeof extras.style === "number" ? extras.style : ElevenLabsProvider.EXTRA_DEFAULTS.style,
      use_speaker_boost:
        typeof extras.speakerBoost === "boolean"
          ? extras.speakerBoost
          : ElevenLabsProvider.EXTRA_DEFAULTS.speakerBoost,
    };

    // === ElevenLabs REST-API ===
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const body = {
      text: sentence,
      model_id: model,
      voice_settings,
      output_format: outputFormat,  // <-- Opus 48 kHz anfordern
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
      throw new Error(`ElevenLabs TTS failed: HTTP ${res.status} ${res.statusText} ${text}`);
    }

    // === Fast-Path: Ist der Stream bereits Ogg/Opus? (Header "OggS") ===
    const reader = res.body.getReader();
    const peekChunks: Uint8Array[] = [];
    let received = 0;

    // Kleiner Peek (z. B. 4..64 KB), um auf "OggS" zu prüfen
    const peekTarget = 65536;
    while (received < peekTarget) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.length) {
        peekChunks.push(value);
        received += value.length;
        if (received >= 4) break;
      }
    }

    const first = peekChunks.length ? peekChunks[0] : new Uint8Array(0);
    const isOgg = first.length >= 4 &&
      first[0] === 0x4F && first[1] === 0x67 && first[2] === 0x67 && first[3] === 0x53; // "OggS"

    if (isOgg) {
      // Direkt als Ogg/Opus an Discord geben (kein FFmpeg)
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

      const usedExtras = {
        ...extras,
        language: langTag,
        model,
        voiceId,
        outputFormat,
        container: "ogg",
        codec: "opus",
        note: "fast-path (no ffmpeg)",
      };

      return [
        new Payload(pass as unknown as Readable, sentence, ElevenLabsProvider.NAME, usedExtras),
      ];
    }

    // === Fallback: verlustfreies Remuxing nach Ogg/Opus (kein Re-Encode) ===
    const ffmpegArgs = [
      "-i", "pipe:0",
      "-f", "ogg",
      "-c:a", "copy",        // nur Container-Mux
      "-application", "voip",
      "pipe:1",
    ];
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    ffmpeg.stderr.on("data", (d) => console.error(`[FFmpeg] ${d}`));

    // Peek-Chunks + Rest in ffmpeg.stdin pumpen
    for (const c of peekChunks) ffmpeg.stdin.write(Buffer.from(c));
    (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) ffmpeg.stdin.write(Buffer.from(value));
      }
      ffmpeg.stdin.end();
    })();

    const usedExtras = {
      ...extras,
      language: langTag,
      model,
      voiceId,
      outputFormat,
      container: "ogg",
      codec: "opus",
      note: "fallback (remux only, no re-encode)",
    };

    return [
      new Payload(ffmpeg.stdout as unknown as Readable, sentence, ElevenLabsProvider.NAME, usedExtras),
    ];
  }

  getPlayLogMessage(payload: Payload, guild: Guild) {
    const {
      sentence,
      extras: { language, model, voiceId, outputFormat, container, codec, note },
    } = payload;

    return `(ElevenLabs): Saying "${sentence}" with model ${model} (${language}, voiceId: ${voiceId}, ${outputFormat}, ${container}/${codec}${note ? ", " + note : ""}) in guild ${guild.name}.`;
  }
}

export default ElevenLabsProvider;