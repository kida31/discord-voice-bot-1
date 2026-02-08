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

  static EXTRA_FIELDS = ["language", "model", "speed"];
  static EXTRA_DEFAULTS = {
    language: "en-US",
    model: "gemini-2.5-flash-tts", // "google_cloud_standard",  "chirp_3_hd", "gemini-2.5-flash-tts"
    speed: 1.0,
    instruction: "Read in a anime waifu style, welcoming tone.",
  };

  private client: TextToSpeechClient;

  constructor() {
    // Stellt sicher, dass GOOGLE_APPLICATION_CREDENTIALS Umgebungsvariable gesetzt ist
    this.client = new TextToSpeechClient();
  }

  async create(
    sentence: string,
    extras: { language: string; model?: string; speed?: number; ssml?: boolean; ssmlContent?: string; instruction?: string } = GoogleCloudProvider.EXTRA_DEFAULTS,
  ): Promise<Payload[]> {
    try {
      const model = extras.model || GoogleCloudProvider.EXTRA_DEFAULTS.model;

      const languageCode = extras.language;

      // Build input: support plain text, SSML content, or instruction-based SSML
      let input: { text?: string; ssml?: string } = { text: sentence };
      if (extras.ssmlContent) {
        input = { ssml: extras.ssmlContent };
      } else if (extras.ssml || extras.instruction) {
        const instruction = extras.instruction ?? "";
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const ssmlBody = `${instruction ? `<p>${esc(instruction)}</p>` : ""}<p>${esc(sentence)}</p>`;
        input = { ssml: `<speak>${ssmlBody}</speak>` };
      }

      const request = {
        input,
        voice: {
          languageCode: languageCode,
        },
        audioConfig: {
          audioEncoding: "LINEAR16" as const,
          speakingRate: extras.speed || 1.0,
        },
        model: model, // z.B. "chirp_3_hd" oder "gemini-2.5-flash-tts"
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
      extras: { language, model, speed },
    } = payload;

    return `(Google Cloud): Saying "${sentence}" with model ${model} (${language}) at speed ${speed} in guild ${guild.name}.`;
  }
}