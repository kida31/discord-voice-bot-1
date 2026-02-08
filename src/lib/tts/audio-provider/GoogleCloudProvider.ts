import type { Guild } from "discord.js";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Readable } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

export class GoogleCloudProvider implements TTSService {
  static NAME = "Google Cloud";
  static FRIENDLY_NAME = "Google Cloud Text-to-Speech Provider";

  static EXTRA_FIELDS = ["language", "model", "speed", "voice", "pitch"];
  static EXTRA_DEFAULTS = {
    language: "en-US",
    model: "chirp_3_hd", // kostenlos
    voice: "en-US-Chirp3-HD-Zephyr",
    speed: 1.0,
    pitch: 0.0,
  };

  private client: TextToSpeechClient;

  constructor() {
    this.client = new TextToSpeechClient();
  }

  /** Map: Default-Voices pro Sprache (erweiterbar) */
  private static DEFAULT_VOICE_BY_LANG: Record<string, string> = {
    "en-US": "en-US-Chirp3-HD-Zephyr",
    "de-DE": "de-DE-Chirp3-HD-Zephyr",
    "fr-FR": "fr-FR-Chirp3-HD-Zephyr",
    "es-ES": "es-ES-Chirp3-HD-Zephyr",
    "pt-BR": "pt-BR-Chirp3-HD-Zephyr",
    "ja-JP": "ja-JP-Chirp3-HD-Zephyr",
    "ko-KR": "ko-KR-Chirp3-HD-Zephyr",
    "cmn-CN": "cmn-CN-Chirp3-HD-Zephyr",
    // Füge hier weitere gewünschte Defaults hinzu
  };

  /** Prüft, ob language ein valider Prefix ll-CC ist (ll=2-3 lowercase, CC=2 uppercase) */
  private static isLanguageTag(tag?: string): tag is string {
    return !!tag && /^[a-z]{2,3}-[A-Z]{2}$/.test(tag);
  }

  /**
   * Passt eine gegebene Voice so an, dass ihr Prefix (ll-CC) dem gewünschten language entspricht.
   * Beispiele:
   *  - language = "de-DE", voice = "en-US-Chirp3-HD-Zephyr"  -> "de-DE-Chirp3-HD-Zephyr"
   *  - language = "cmn-CN", voice = "cmn-TW-Standard-A"      -> "cmn-CN-Standard-A"
   *  - voice nicht gesetzt -> nutze Default-Voice für language (falls vorhanden)
   */
  private static normalizeVoiceForLanguage(language: string, voice?: string): string {
    const lang = this.isLanguageTag(language) ? language : GoogleCloudProvider.EXTRA_DEFAULTS.language;

    // Falls keine Voice gesetzt ist, nimm eine passende Default-Voice pro Sprache (oder fallback)
    if (!voice || voice.trim().length === 0) {
      return (
        GoogleCloudProvider.DEFAULT_VOICE_BY_LANG[lang] ??
        // Fallback: nimm die Default-Voice, passe Prefix an
        GoogleCloudProvider.EXTRA_DEFAULTS.voice.replace(/^[a-z]{2,3}-[A-Z]{2}/, lang)
      );
    }

    // Wenn Voice bereits mit dem gewünschten Prefix beginnt: unverändert
    if (voice.startsWith(`${lang}-`)) return voice;

    // Wenn Voice ein ll-CC Prefix hat: ersetze es
    if (/^[a-z]{2,3}-[A-Z]{2}\b/.test(voice)) {
      return voice.replace(/^[a-z]{2,3}-[A-Z]{2}/, lang);
    }

    // Sonst: Prefix voranstellen
    return `${lang}-${voice}`;
  }

  async create(
    sentence: string,
    extras: { language?: string; model?: string; speed?: number; voice?: string; pitch?: number } = GoogleCloudProvider.EXTRA_DEFAULTS,
  ): Promise<Payload[]> {
    try {
      const model = extras.model || GoogleCloudProvider.EXTRA_DEFAULTS.model;

      // Sprachcode kommt *vom Command* bzw. aus extras.language, nicht aus voice!
      const languageCode =
        (extras.language && GoogleCloudProvider.isLanguageTag(extras.language) ? extras.language : undefined) ||
        GoogleCloudProvider.EXTRA_DEFAULTS.language;

      // Stimme an den Sprachcode anpassen
      const voice = GoogleCloudProvider.normalizeVoiceForLanguage(languageCode, extras.voice);

      // Optional: sprachspezifischer Default-Pitch (dein Ja-Boost bleibt erhalten)
      const pitchSemitones =
        typeof extras.pitch === "number"
          ? extras.pitch
          : languageCode.startsWith("ja")
          ? 10.0
          : 0.0;

      const request = {
        input: { text: sentence },
        voice: {
          languageCode,
          name: voice,
        },
        audioConfig: {
          audioEncoding: "LINEAR16" as const,
          speakingRate: extras.speed ?? GoogleCloudProvider.EXTRA_DEFAULTS.speed,
          pitch: pitchSemitones,
        },
        model, // "chirp_3_hd" kostenlos
      };

      const [response] = await this.client.synthesizeSpeech(request);

      if (response.audioContent) {
        const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
        console.log(
          `[GoogleCloud TTS] Audio received: ${audioBuffer.length} bytes for "${sentence}" (lang=${languageCode}, voice=${voice})`
        );

        const ffmpegProcess = spawn("ffmpeg", [
          "-i", "pipe:0",
          "-f", "ogg",
          "-c:a", "libopus",
          "-b:a", "192k",
          "-ar", "48000",
          "-ac", "2",
          "-application", "voip",
          "pipe:1",
        ]);

        ffmpegProcess.stderr.on("data", (data) => {
          console.error(`[FFmpeg] ${data}`);
        });

        ffmpegProcess.stdin.write(audioBuffer);
        ffmpegProcess.stdin.end();

        const usedExtras = {
          ...extras,
          language: languageCode,
          model,
          voice,
          pitch: pitchSemitones,
          speed: extras.speed ?? GoogleCloudProvider.EXTRA_DEFAULTS.speed,
        };

        return [
          new Payload(ffmpegProcess.stdout as unknown as Readable, sentence, GoogleCloudProvider.NAME, usedExtras),
        ];
      }

      throw new Error("Keine Audio-Inhalte von Google Cloud TTS erhalten");
    } catch (error) {
      console.error("Google Cloud TTS Error:", error);
      throw error;
    }
  }

  getPlayLogMessage(payload: Payload, guild: Guild) {
    const {
      sentence,
      extras: { language, model, speed, pitch, voice },
    } = payload;

    return `(Google Cloud): Saying "${sentence}" with model ${model} (${language}, voice: ${voice}) at speed ${speed} pitch ${pitch} in guild ${guild.name}.`;
  }
}