// const googleTTS = require("google-tts-api");
import type { Guild } from "discord.js";
import googleTTS from "google-tts-api";
import { Payload, type TTSService } from "./tts-stuff";

/**
 * A concrete TTS provider for the Google Translate API TTS.
 */
export class GoogleProvider implements TTSService {
  static NAME = "Google";
  static FRIENDLY_NAME = "Google Translate Provider";

  static EXTRA_FIELDS = ["language", "speed"];
  static EXTRA_DEFAULTS = {
    language: "en",
    speed: "normal",
  };

  async create(
    sentence: string,
    extras: { language: any; speed?: string },
  ): Promise<Payload[]> {
    return new Promise((resolve, reject) => {
      try {
        const data = googleTTS.getAllAudioUrls(sentence, {
          lang: extras.language,
          slow: extras.speed === "normal",
          splitPunct: ",.?!",
        });

        resolve(
          data.map(({ url, shortText }) => {
            return new Payload(url, shortText, GoogleProvider.NAME, extras);
          }),
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  getPlayLogMessage(payload: Payload, guild: Guild) {
    const {
      sentence,
      extras: { language, speed },
    } = payload;

    return `(Google): Saying ${sentence} with language ${language} with ${speed} speed in guild ${guild.name}.`;
  }
}
