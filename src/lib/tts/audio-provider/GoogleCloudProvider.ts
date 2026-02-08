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

  static EXTRA_FIELDS = ["language", "model", "speed", "voice"];
  static EXTRA_DEFAULTS = {
    language: "en-US",
    model: "gemini-2.5-flash-tts", // "google_cloud_standard",  "chirp_3_hd", "gemini-2.5-flash-tts" #Matze: Bitte auf "chirp_3_hd" lassen, da kostenlos. Sonnst bin ich arm. :)
    speed: 1.0,
    voice: "en-US-Chirp3-HD-Leda", // z.B. "archernar" oder andere verfügbare Stimmen
    instruction: "Read in a anime waifu style, welcoming tone.",
  };

  private client: TextToSpeechClient;

  constructor() {
    // Stellt sicher, dass GOOGLE_APPLICATION_CREDENTIALS Umgebungsvariable gesetzt ist
    this.client = new TextToSpeechClient();
  }

  async create(
    sentence: string,
    extras: { language: string; model?: string; speed?: number; voice?: string; ssml?: boolean; ssmlContent?: string; instruction?: string } = GoogleCloudProvider.EXTRA_DEFAULTS,
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
          name: voice, // z.B. "archernar", "en-US-Neural2-C", etc.
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
      extras: { language, model, speed, voice, ssml, instruction },
    } = payload;

    let msg = `(Google Cloud): Saying "${sentence}" with model ${model} voice ${voice} (${language}) at speed ${speed}`;
    if (ssml) msg += ' (ssml)';
    if (instruction) msg += ` instruction="${instruction}"`;
    msg += ` in guild ${guild.name}.`;
    return msg;
  }
}