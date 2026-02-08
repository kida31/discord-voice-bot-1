import type { Guild } from "discord.js";
import { Readable } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

// Node 18+ hat global fetch. Für ältere Node-Versionen ggf. node-fetch polyfillen.
// import fetch from "node-fetch";

type ElevenVoiceSettings = {
  stability?: number;          // 0..1
  similarity_boost?: number;   // 0..1
  style?: number;              // 0..1 (optional)
  use_speaker_boost?: boolean; // default true
  // Achtung: "speed" ist v. a. im WebSocket-Streaming dokumentiert.
  // Wir filtern Geschwindigkeit/Pitch robust via FFmpeg (s.u.).
};

export class ElevenLabsProvider implements TTSService {
  static NAME = "ElevenLabs";
  static FRIENDLY_NAME = "ElevenLabs Text-to-Speech Provider";

  // Wir behalten deine gewohnten Extras bei und mappen sie intern.
  static EXTRA_FIELDS = [
    "language", "model", "voiceId",
    "speed", "pitch", // via FFmpeg-Filter
    "stability", "similarityBoost", "style", "speakerBoost",
    "outputFormat"
  ] as const;

  static EXTRA_DEFAULTS = {
    language: "en-US",
    model: "eleven_multilingual_v2",          // schnell, gute Qualität
    voiceId: "eVItLK1UvXctxuaRV2Oq",     // 
    speed: 1.0,
    pitch: 0.0,                          // in Halbtonschritten
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    speakerBoost: true,
    outputFormat: "mp3_44100_128",       // robust für FFmpeg-Input
  };

  // Optionale Defaults je Sprache (du kannst hier deine eigenen Voice-IDs hinterlegen)
  private static DEFAULT_VOICE_BY_LANG: Record<string, string> = {
    "en-US": "eVItLK1UvXctxuaRV2Oq", // George
    // "de-DE": "<DEINE_DE-VOICE-ID>",
    // ...
  };

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("Missing ELEVENLABS_API_KEY for ElevenLabsProvider");
    }
  }

  // Helper: Konvertiert "ll-CC" -> "ll" (für language_code bei multilingualen Modellen)
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
      speed?: number;
      pitch?: number;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      speakerBoost?: boolean;
      outputFormat?: string; // z.B. "mp3_44100_128" | "pcm_44100" | "opus_48000_128"
    } = ElevenLabsProvider.EXTRA_DEFAULTS
  ): Promise<Payload[]> {
    // Defaults ziehen
    const model = extras.model || ElevenLabsProvider.EXTRA_DEFAULTS.model;
    const outputFormat = extras.outputFormat || ElevenLabsProvider.EXTRA_DEFAULTS.outputFormat;

    // Voice-Selection
    const langTag = extras.language || ElevenLabsProvider.EXTRA_DEFAULTS.language;
    const language_code = ElevenLabsProvider.toIso639_1(langTag); // für multilingual models
    const voiceId =
      extras.voiceId ||
      ElevenLabsProvider.DEFAULT_VOICE_BY_LANG[langTag] ||
      ElevenLabsProvider.EXTRA_DEFAULTS.voiceId;

    // Voice-Settings (stability/similarity/style/boost)
    const voice_settings: ElevenVoiceSettings = {
      stability: typeof extras.stability === "number" ? extras.stability : ElevenLabsProvider.EXTRA_DEFAULTS.stability,
      similarity_boost:
        typeof extras.similarityBoost === "number"
          ? extras.similarityBoost
          : ElevenLabsProvider.EXTRA_DEFAULTS.similarityBoost,
      style: typeof extras.style === "number" ? extras.style : ElevenLabsProvider.EXTRA_DEFAULTS.style,
      use_speaker_boost:
        typeof extras.speakerBoost === "boolean" ? extras.speakerBoost : ElevenLabsProvider.EXTRA_DEFAULTS.speakerBoost,
    };

    // HTTP‑Request an ElevenLabs
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const body = {
      text: sentence,
      model_id: model,
      voice_settings,
      // language_code ist v. a. bei den multilingualen Modellen relevant
      ...(language_code ? { language_code } : {}),
      // Nicht alle SDKs setzen via Accept-Header, hier explizit in der Payload:
      output_format: outputFormat,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        // Wir akzeptieren Binärdaten (MP3/PCM/Opus je nach output_format):
        "Accept": "*/*",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS failed: HTTP ${res.status} ${res.statusText} ${text}`);
    }

    // === FFmpeg-Pipeline aufbauen ===
    // Wir wandeln nach Ogg/Opus 48kHz Stereo (Discord-freundlich)
    const ffmpegArgs = [
      "-i", "pipe:0",
      // optionale Filter für Pitch (Halbton) und Speed (Faktor):
      // Pitch (Halbtonschritte) via asetrate/aresample + atempo-Kompensation
      // Speed via atempo
    ];

    const filters: string[] = [];
    const inRate = outputFormat.startsWith("mp3_") ? 44100 : 44100; // konservativ; FFmpeg ermittelt den echten Wert
    const speed = typeof extras.speed === "number" ? extras.speed : ElevenLabsProvider.EXTRA_DEFAULTS.speed;
    const pitchSemitones = typeof extras.pitch === "number" ? extras.pitch : ElevenLabsProvider.EXTRA_DEFAULTS.pitch;

    if (pitchSemitones && pitchSemitones !== 0) {
      const factor = Math.pow(2, pitchSemitones / 12);
      // erst Pitch (ändert Tempo), dann via atempo wieder kompensieren:
      filters.push(`asetrate=${inRate * factor}`, `aresample=${inRate}`, `atempo=${(1 / factor).toFixed(5)}`);
    }

    if (speed && speed !== 1.0) {
      // atempo erlaubt 0.5..2.0 — für Werte außerhalb mehrfach ketten
      const chain = (value: number): string[] => {
        const parts: string[] = [];
        let remaining = value;
        const push = (v: number) => parts.push(`atempo=${v.toFixed(5)}`);
        // Zerlege außerhalb [0.5, 2] in gültige Schritte
        while (remaining < 0.5) { push(0.5); remaining /= 0.5; }
        while (remaining > 2.0) { push(2.0); remaining /= 2.0; }
        push(remaining);
        return parts;
      };
      filters.push(...chain(speed));
    }

    if (filters.length > 0) {
      ffmpegArgs.push("-filter:a", filters.join(","));
    }

    ffmpegArgs.push(
      "-f", "ogg",
      "-c:a", "libopus",
      "-b:a", "192k",
      "-ar", "48000",
      "-ac", "2",
      "-application", "voip",
      "pipe:1",
    );

    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

    ffmpegProcess.stderr.on("data", (data) => {
      console.error(`[FFmpeg] ${data}`);
    });

    // Streamen (kein komplettes Puffern)
    // @ts-ignore NodeJS.ReadableStream ist kompatibel
    (res.body as unknown as Readable).pipe(ffmpegProcess.stdin);

    const usedExtras = {
      ...extras,
      language: langTag,
      model,
      voiceId,
      outputFormat,
      speed,
      pitch: pitchSemitones,
      stability: voice_settings.stability,
      similarityBoost: voice_settings.similarity_boost,
      style: voice_settings.style,
      speakerBoost: voice_settings.use_speaker_boost,
    };

    return [
      new Payload(ffmpegProcess.stdout as unknown as Readable, sentence, ElevenLabsProvider.NAME, usedExtras),
    ];
  }

  getPlayLogMessage(payload: Payload, guild: Guild) {
    const {
      sentence,
      extras: { language, model, speed, pitch, voiceId },
    } = payload;

    return `(ElevenLabs): Saying "${sentence}" with model ${model} (${language}, voiceId: ${voiceId}) at speed ${speed} pitch ${pitch} in guild ${guild.name}.`;
  }
}