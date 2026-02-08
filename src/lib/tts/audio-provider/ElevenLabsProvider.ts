// src/tts/providers/ElevenLabsProvider.ts
import type { Guild } from "discord.js";
import { Readable, PassThrough } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

// import fetch from "node-fetch"; // falls dein Node kein global fetch besitzt

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
    language: "en-US",
    model: "eleven_multilingual_v2",          // gute Qualität & niedrige Latenz
    voiceId: "eVItLK1UvXctxuaRV2Oq",     // Beispiel-Voice-ID ("George")
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    speakerBoost: true,
    // Für Discord optimal: 48 kHz Opus
    outputFormat: "opus_48000_128",
  };

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    if (!this.apiKey) throw new Error("Missing ELEVENLABS_API_KEY for ElevenLabsProvider");
  }

  private static toIso639_1(langTag?: string): string | undefined {
    if (!langTag) return undefined;
    const m = langTag.match(/^([a-z]{2,3})-[A-Z]{2}$/);
    return m ? m[1] : undefined; // 'de-DE' -> 'de'
  }

  /** Erkennung: "OggS" am Anfang? */
  private static looksLikeOgg(buf: Uint8Array): boolean {
    return buf.length >= 4 && buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53;
  }

  /** Erkennung: MP3? (ID3-Header oder Frame-Sync 0xFFEx/0xFFFB etc.) */
  private static looksLikeMp3(buf: Uint8Array): boolean {
    if (buf.length < 3) return false;
    const id3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33; // "ID3"
    const frameSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
    return id3 || frameSync;
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
      output_format: outputFormat, // <— Opus 48 kHz anfordern
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

    // Logge Content-Type zur Diagnose (z. B. audio/ogg, audio/mpeg, audio/opus)
    const contentType = res.headers.get("content-type") || "";
    console.log(`[ElevenLabs] content-type: ${contentType}`);

    // === Peek für Format-Erkennung ===
    const reader = res.body.getReader();
    const peekChunks: Uint8Array[] = [];
    let received = 0;
    const peekTarget = 65536;

    while (received < peekTarget) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.length) {
        peekChunks.push(value);
        received += value.length;
        if (received >= 4) break; // reicht zur Magie-Prüfung
      }
    }

    const first = peekChunks.length ? peekChunks[0] : new Uint8Array(0);
    const isOgg = ElevenLabsProvider.looksLikeOgg(first);
    const isMp3 = ElevenLabsProvider.looksLikeMp3(first);

    if (isOgg) {
      // Fast-Path: direkt als Ogg/Opus an Discord (kein FFmpeg)
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

      return [new Payload(pass as unknown as Readable, sentence, ElevenLabsProvider.NAME, usedExtras)];
    }

    // FFmpeg-Pipeline aufbauen:
    // 1) Falls Opus erwartet (opus_48000_*), zuerst verlustfrei remuxen (copy).
    // 2) Falls MP3 (oder Remux scheitert), transkodieren nach Opus 48 kHz Stereo.
    const expectedOpus = (outputFormat ?? "").startsWith("opus_48000");

    const remuxArgs = ["-i", "pipe:0", "-f", "ogg", "-c:a", "copy", "-application", "voip", "pipe:1"];
    const transcodeArgs = ["-i", "pipe:0", "-f", "ogg", "-c:a", "libopus", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-application", "voip", "pipe:1"];

    // Wenn es klar nach MP3 aussieht oder content-type audio/mpeg ist -> direkt transcodieren
    let ffmpeg = spawn("ffmpeg", (isMp3 || /audio\/mpeg/i.test(contentType)) ? transcodeArgs : (expectedOpus ? remuxArgs : transcodeArgs));

    // Diagnose & Remux->Transcode Retry (wenn Remux scheitert)
    let retried = false;
    ffmpeg.stderr.on("data", (d) => {
      const msg = d.toString();
      console.error(`[FFmpeg] ${msg}`);
      if (!retried && /Unsupported codec id|Could not write header|Invalid argument/.test(msg)) {
        retried = true;
        try { ffmpeg.kill("SIGKILL"); } catch {}
        ffmpeg = spawn("ffmpeg", transcodeArgs);
        // Bereits gelesene Daten erneut einspeisen:
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

    // Ersten Peek in stdin schieben + Rest lesen
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
      note: retried ? "transcoded (libopus)" : (isMp3 ? "transcoded (mp3->opus)" : (expectedOpus ? "remux (copy)" : "transcoded")),
    };

    return [new Payload(ffmpeg.stdout as unknown as Readable, sentence, ElevenLabsProvider.NAME, usedExtras)];
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