import type { Guild } from "discord.js";
import { Readable, PassThrough } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

// import fetch from "node-fetch"; // falls dein Node kein global fetch hat

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
    model: "eleven_turbo_v2_5",
    voiceId: "JBFqnCBsd6RMkjVDRZzb", // Beispiel-Voice-ID "George"
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    speakerBoost: true,
    // Für Discord-Ziel optimal: 48 kHz Opus
    outputFormat: "opus_48000_128",
  };

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("Missing ELEVENLABS_API_KEY for ElevenLabsProvider");
    }
  }

  private static toIso639_1(langTag?: string): string | undefined {
    if (!langTag) return undefined;
    const m = langTag.match(/^([a-z]{2,3})-[A-Z]{2}$/);
    return m ? m[1] : undefined; // 'de-DE' -> 'de'
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
      outputFormat?: string;
    } = ElevenLabsProvider.EXTRA_DEFAULTS
  ): Promise<Payload[]> {
    const model = extras.model || ElevenLabsProvider.EXTRA_DEFAULTS.model;
    const outputFormat = extras.outputFormat || ElevenLabsProvider.EXTRA_DEFAULTS.outputFormat;
    const langTag = extras.language || ElevenLabsProvider.EXTRA_DEFAULTS.language;
    const language_code = ElevenLabsProvider.toIso639_1(langTag); // bei multilingualen Modellen nützlich
    const voiceId = extras.voiceId || ElevenLabsProvider.EXTRA_DEFAULTS.voiceId;

    const voice_settings = {
      stability: typeof extras.stability === "number" ? extras.stability : ElevenLabsProvider.EXTRA_DEFAULTS.stability,
      similarity_boost:
        typeof extras.similarityBoost === "number" ? extras.similarityBoost : ElevenLabsProvider.EXTRA_DEFAULTS.similarityBoost,
      style: typeof extras.style === "number" ? extras.style : ElevenLabsProvider.EXTRA_DEFAULTS.style,
      use_speaker_boost:
        typeof extras.speakerBoost === "boolean" ? extras.speakerBoost : ElevenLabsProvider.EXTRA_DEFAULTS.speakerBoost,
    };

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const body = {
      text: sentence,
      model_id: model,
      voice_settings,
      output_format: outputFormat,      // <- Opus 48 kHz
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

    // === FAST-PATH: Prüfe, ob die Antwort bereits Ogg-Container ist ===
    // Wir lesen einen kleinen Peek (z. B. 64 KB) aus dem Stream,
    // suchen nach "OggS" am Anfang und streamen bei Erfolg direkt weiter.
    const peekSize = 65536;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    // lies bis peekSize oder EOF
    while (received < peekSize) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.length) {
        chunks.push(value);
        received += value.length;
        if (received >= 4) break; // reicht für "OggS" Check; optional mehr lesen
      }
    }

    const head = chunks.length ? chunks[0].subarray(0, Math.min(chunks[0].length, 4)) : new Uint8Array(0);
    const isOgg = head.length >= 4 &&
      head[0] === 0x4F && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53; // "OggS"

    if (isOgg) {
      // Direktes Durchreichen als Ogg/Opus
      const pass = new PassThrough();
      // bereits gelesene Bytes zurückschieben
      for (const c of chunks) pass.write(Buffer.from(c));
      // restlichen Response-Stream weiterpumpen
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

    // === FALLBACK: verlustfreies Remuxing nach Ogg/Opus (ohne Re-Encode) ===
    const ffmpegArgs = [
      "-i", "pipe:0",
      "-f", "ogg",
      "-c:a", "copy",   // keine Rekodierung, nur Container-Mux
      "-application", "voip",
      "pipe:1",
    ];
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    ffmpeg.stderr.on("data", (d) => console.error(`[FFmpeg] ${d}`));

    // schreibe Peek-Chunks + Rest in ffmpeg.stdin
    for (const c of chunks) ffmpeg.stdin.write(Buffer.from(c));
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
      note: "fallback (ffmpeg remux only, no re-encode)",
    };

    return [
      new Payload(ffmpeg.stdout as unknown as Readable, sentence, ElevenLabsProvider.NAME, usedExtras),
    ];
  }

  getPlayLogMessage(payload: Payload, guild: Guild) {
    const { sentence, extras: { language, model, voiceId, outputFormat, container, codec, note } } = payload;
    return `(ElevenLabs): Saying "${sentence}" with model ${model} (${language}, voiceId: ${voiceId}, ${outputFormat}, ${container}/${codec}${note ? ", " + note : ""}) in guild ${guild.name}.`;
  }
}
``