// src/tts/providers/ElevenLabsProvider.ts
import type { Guild } from "discord.js";
import { Readable, PassThrough } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

// Node 18+ hat global fetch. Falls dein Node älter ist, optional:
// import fetch from "node-fetch";

type ElevenVoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
};

/* ============================================
   Language -> VoiceId Mapping (rein statisch)
   ============================================ */

// >>> Trage hier deine Voice-IDs ein <<<
// Keys können "ll-CC" (z. B. "de-DE") ODER "ll" (z. B. "de") sein.
// Reihenfolge der Verwendung: extras.voiceId > ll-CC > ll > DEFAULT_VOICE_ID
const VOICE_BY_LANGUAGE: Record<string, string> = {
  "en-US": "eVItLK1UvXctxuaRV2Oq", // aktueller Default
  "de-DE": "iwP1PxYYSTdHA1qXlwFe",
  "ja-JP": "hMK7c1GPJmptCzI4bQIu",
  "vn-VN": "a3AkyqGG4v8Pg7SWQ0Y3",
  "ko-KR": "sf8Bpb1IU97NI9BHSMRf",
  // Basis-Sprachen optional:
  "en": "eVItLK1UvXctxuaRV2Oq",
  // "de": "<DEINE_DE_BASE_VOICE_ID>",
  // "ja": "<DEINE_JA_BASE_VOICE_ID>",
};

// Globaler Fallback, falls keine Sprache matched:
const DEFAULT_VOICE_ID = "eVItLK1UvXctxuaRV2Oq";

/** "de-DE" | "de" -> "de" */
function toBaseLang(tag?: string): string | undefined {
  if (!tag) return undefined;
  const m = tag.match(/^([a-z]{2,3})(?:-[A-Z]{2})?$/);
  return m ? m[1] : undefined;
}

/** Nur Sprachcode angegeben? -> auf Standard-Region heben (anpassbar) */
function normalizeLangTag(lang?: string): string | undefined {
  if (!lang) return undefined;
  if (/^[a-z]{2,3}$/.test(lang)) {
    const defaults: Record<string, string> = {
      en: "en-US",
      de: "de-DE",
      ja: "ja-JP",
      pt: "pt-BR",
    };
    return defaults[lang] || lang;
  }
  return lang;
}

/** Wähle VoiceId anhand Sprache (ll-CC → ll → default) */
function pickVoiceIdByLanguage(lang?: string): string {
  if (!lang) return DEFAULT_VOICE_ID;
  if (VOICE_BY_LANGUAGE[lang]) return VOICE_BY_LANGUAGE[lang];
  const base = toBaseLang(lang);
  if (base && VOICE_BY_LANGUAGE[base]) return VOICE_BY_LANGUAGE[base];
  return DEFAULT_VOICE_ID;
}

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
    model: "eleven_multilingual_v2",   // hochwertige, mehrsprachige Qualität
    voiceId: DEFAULT_VOICE_ID,
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    speakerBoost: true,
    // Für Discord optimal: 48 kHz Opus (kann direkt als Ogg/Opus gespielt werden)
    outputFormat: "opus_48000_128",
  };

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    if (!this.apiKey) throw new Error("Missing ELEVENLABS_API_KEY for ElevenLabsProvider");
  }

  /** "ll-CC" -> "ll" (für language_code bei multilingualen Modellen) */
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
    // Sprache vorbereiten & Voice wählen
    const langInput = extras.language || ElevenLabsProvider.EXTRA_DEFAULTS.language;
    const langTag = normalizeLangTag(langInput);
    const language_code = ElevenLabsProvider.toIso639_1(langTag);

    const model = extras.model || ElevenLabsProvider.EXTRA_DEFAULTS.model;
    const outputFormat = extras.outputFormat || ElevenLabsProvider.EXTRA_DEFAULTS.outputFormat;

    const voiceId =
      extras.voiceId /* explizit gewinnt */ ??
      pickVoiceIdByLanguage(langTag);

    const voice_settings: ElevenVoiceSettings = {
      stability: typeof extras.stability === "number" ? extras.stability : ElevenLabsProvider.EXTRA_DEFAULTS.stability,
      similarity_boost:
        typeof extras.similarityBoost === "number" ? extras.similarityBoost : ElevenLabsProvider.EXTRA_DEFAULTS.similarityBoost,
      style: typeof extras.style === "number" ? extras.style : ElevenLabsProvider.EXTRA_DEFAULTS.style,
      use_speaker_boost:
        typeof extras.speakerBoost === "boolean" ? extras.speakerBoost : ElevenLabsProvider.EXTRA_DEFAULTS.speakerBoost,
    };

    // === ElevenLabs REST-API ===
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const body = {
      text: sentence,
      model_id: model,
      voice_settings,
      output_format: outputFormat, // Opus 48 kHz anfordern
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

    // Content-Type zu Diagnosezwecken loggen (z. B. audio/ogg, audio/mpeg, audio/opus)
    const contentType = res.headers.get("content-type") || "";
    console.log(`[ElevenLabs] content-type: ${contentType}`);

    // === Peek für Format-Erkennung (Ogg/Opus direkt durchreichen) ===
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
        if (received >= 4) break; // OggS-Prüfung reicht
      }
    }

    const first = peekChunks.length ? peekChunks[0] : new Uint8Array(0);
    const isOgg = ElevenLabsProvider.looksLikeOgg(first);
    const isMp3 = ElevenLabsProvider.looksLikeMp3(first);
    const expectedOpus = (outputFormat ?? "").startsWith("opus_48000");

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

    // === FFmpeg-Fallback ===
