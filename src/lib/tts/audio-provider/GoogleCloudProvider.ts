import type { Guild } from "discord.js";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
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
    model: "chirp_3_hd", // "google_cloud_standard" oder "chirp_3_hd" - Matze: Bitte auf "chirp_3_hd" lassen, da kostenlos. Sonnst bin ich arm. :)
    speed: 1.0,
  };

  private client: TextToSpeechClient;

  constructor() {
    // Stellt sicher, dass GOOGLE_APPLICATION_CREDENTIALS Umgebungsvariable gesetzt ist
    this.client = new TextToSpeechClient();
  }

  async create(
    sentence: string,
    extras: { language: string; model?: string; speed?: number } = GoogleCloudProvider.EXTRA_DEFAULTS,
  ): Promise<Payload[]> {
    try {
      const model = extras.model || GoogleCloudProvider.EXTRA_DEFAULTS.model;
      
      const request = {
        input: { text: sentence },
        voice: {
          languageCode: extras.language,
        },
        audioConfig: {
          audioEncoding: "MP3" as const,
          speakingRate: extras.speed || 1.0,
        },
        model: model, // "chirp_3_hd" für kostenloses Modell
      };

      const [response] = await this.client.synthesizeSpeech(request);
      
      // Audio-Daten in einen Stream konvertieren
      if (response.audioContent) {
        const audioBuffer = Buffer.from(response.audioContent as string, "base64");
        
        return [
          new Payload(audioBuffer, sentence, GoogleCloudProvider.NAME, extras),
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