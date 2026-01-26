// const googleTTS = require("google-tts-api");
import type { Guild } from "discord.js";
import googleTTS from "google-tts-api";

/**
 * This class represents the data that is used to run the TTSPlayer.
 */
class Payload {
  constructor(
    public resource,
    public sentence,
    public providerName,
    public extras,
  ) {
    /**
     * The readable stream or URL that points to a readable stream of the TTS message to be played.
     * @type {string|ReadableStream}
     */
    this.resource = resource;

    /**
     * The sentence that will be played for TTS.
     * @type {string}
     */
    this.sentence = sentence;

    /**
     * The name of the provider. Generally should be set to the NAME static property of any concrete provider.
     * @type {string}
     */
    this.providerName = providerName;

    /**
     * Any extra information that the payload should contain.
     * @type {object}
     */
    this.extras = extras;
  }
}

/**
 * A concrete TTS provider for the Google Translate API TTS.
 */
export class GoogleProvider {
  static NAME = "Google";
  static FRIENDLY_NAME = "Google Translate Provider";

  static EXTRA_FIELDS = ["language", "speed"];
  static EXTRA_DEFAULTS = {
    language: "en",
    speed: "normal",
  };

  async createPayload(
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
