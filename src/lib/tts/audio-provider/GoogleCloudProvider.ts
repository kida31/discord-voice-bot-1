import type { Guild } from "discord.js";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Readable } from "stream";
import { spawn } from "child_process";
import { type TTSService, Payload } from "../tts-stuff";

/**
 * A concrete TTS provider for the Google Cloud Text-to-Speech API.
 * Benötigt: npm install @google-cloud/text-to-speech
 * Und Google Cloud Credentials: https://cloud.google.com/docs/authentication/getting-started
 */
export class GoogleCloudProvider implements TTSService {
  static NAME = "Google Cloud";
  static FRIENDLY_NAME = "Google Cloud Text-to-Speech Provider";

  static EXTRA_FIELDS = ["language", "model", "speed", "voice", "pitch"];
  static EXTRA_DEFAULTS = {
    language: "en-US",
    model: "chirp_3_hd", // "google_cloud_standard" oder "chirp_3_hd" - Matze: Bitte auf "chirp_3_hd" lassen, da kostenlos. Sonnst bin ich arm. :)
    speed: 1.0,
    voice: "en-US-Chirp3-HD-Leda", // z.B. "archernar" oder andere verfügbare Stimmen
    pitch: 0.0,
  };

  private client: TextToSpeechClient;

  constructor() {
    // Stellt sicher, dass GOOGLE_APPLICATION_CREDENTIALS Umgebungsvariable gesetzt ist
    this.client = new TextToSpeechClient();
  }

  async create(
    sentence: string,
    extras: { language: string; model?: string; speed?: number; voice?: string; pitch?: number } = GoogleCloudProvider.EXTRA_DEFAULTS,
  ): Promise<Payload[]> {
    try {
      const model = extras.model || GoogleCloudProvider.EXTRA_DEFAULTS.model;
      const voice = extras.voice || GoogleCloudProvider.EXTRA_DEFAULTS.voice;
      
      // Extrahiere language code aus voice name (z.B. "en-US-Neural2-C" -> "en-US")
      let languageCode = extras.language;
      if (voice && voice.includes("-")) {
        const voiceParts = voice.split("-");
        if (voiceParts.length >= 2) {
          languageCode = `${voiceParts[0]}-${voiceParts[1]}`;
        }
      }
      
      const pitchSemitones = extras.pitch ?? (languageCode && languageCode.startsWith("ja") ? 10.0 : 0.0);

      const request = {
        input: { text: sentence },
        voice: {
          languageCode: languageCode,
          name: voice, // z.B. "archernar", "en-US-Neural2-C", etc.
        },
        audioConfig: {
          audioEncoding: "LINEAR16" as const,
          speakingRate: extras.speed || 1.0,
          pitch: pitchSemitones,
        },
        model: model, // "chirp_3_hd" für kostenloses Modell
      };

      const [response] = await this.client.synthesizeSpeech(request);
      
      // Audio-Daten in einen Stream konvertieren
      if (response.audioContent) {
        // audioContent ist bereits Uint8Array, in Stream konvertieren für discord.js voice
        const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
        console.log(`[GoogleCloud TTS] Audio received: ${audioBuffer.length} bytes for "${sentence}"`);
        
        // LINEAR16 → OGG Opus konvertieren für HD Audio Quality auf Discord
        const ffmpegProcess = spawn("ffmpeg", [
          "-i", "pipe:0",           // Input from stdin (LINEAR16 PCM)
          "-f", "ogg",              // Output format: OGG
          "-c:a", "libopus",        // Audio codec: Opus (HD Quality)
          "-b:a", "192k",           // Bitrate: 192k (HD Quality)
          "-ar", "48000",           // Sample rate: 48kHz (Discord Standard)
          "-ac", "2",               // Channels: Stereo
          "-application", "voip",   // Optimized for voice
          "pipe:1",                 // Output to stdout
        ]);
        
        ffmpegProcess.stdin.write(audioBuffer);
        ffmpegProcess.stdin.end();
        
        // Error handling for FFmpeg
        ffmpegProcess.stderr.on("data", (data) => {
          console.error(`[FFmpeg] ${data}`);
        });
        
        return [
          new Payload(ffmpegProcess.stdout, sentence, GoogleCloudProvider.NAME, extras),
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
      extras: { language, model, speed, pitch },
    } = payload;

    return `(Google Cloud): Saying "${sentence}" with model ${model} (${language}) at speed ${speed} pitch ${pitch} in guild ${guild.name}.`;
  }
}