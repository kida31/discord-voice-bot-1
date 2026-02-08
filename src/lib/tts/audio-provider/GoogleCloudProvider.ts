import type { Guild } from "discord.js";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Readable } from "stream";
import { spawn } from "child_process";
import fs from "fs";
import crypto from "crypto";
import https from "https";
import { URL } from "url";
import { type TTSService, Payload } from "../tts-stuff";

/**
 * A concrete TTS provider for the Google Cloud Text-to-Speech API.
 * Benötigt: npm install @google-cloud/text-to-speech
 * Und Google Cloud Credentials: https://cloud.google.com/docs/authentication/getting-started
 */
export class GoogleCloudProvider implements TTSService {
  static NAME = "Google Cloud";
  static FRIENDLY_NAME = "Google Cloud Text-to-Speech Provider";

  static EXTRA_FIELDS = ["language", "model", "speed", "voice", "prompt", "text", "speaker"];
  static EXTRA_DEFAULTS = {
    language: "en-US",
    model: "gemini-2.5-flash-tts", // "google_cloud_standard",  "chirp_3_hd", "gemini-2.5-flash-tts"
    speed: 1.0,
    voice: "Zephyr",
    instruction: "Read in a anime waifu style, welcoming tone.",
  };

  private client: TextToSpeechClient;

  constructor() {
    // Stellt sicher, dass GOOGLE_APPLICATION_CREDENTIALS Umgebungsvariable gesetzt ist
    this.client = new TextToSpeechClient();
  }

  async create(
    sentence: string,
    extras: { language?: string; model?: string; speed?: number; voice?: string; ssml?: boolean; ssmlContent?: string; instruction?: string; prompt?: string; text?: string; speaker?: string; pitch?: number } = GoogleCloudProvider.EXTRA_DEFAULTS,
  ): Promise<Payload[]> {
    try {
      const model = extras.model || GoogleCloudProvider.EXTRA_DEFAULTS.model;

      const languageCode = (extras.language || GoogleCloudProvider.EXTRA_DEFAULTS.language).toString().toLowerCase();

      // Build input: support explicit prompt + text (or fallback to instruction/sentence), or SSML content
      // Matches example JSON: input: { prompt: "...", text: "..." }
      const textSource = extras.text ?? sentence;
      let input: any = { text: textSource };
      if (extras.prompt) input.prompt = extras.prompt;
      else if (extras.instruction) input.prompt = extras.instruction;
      if (extras.ssmlContent) {
        // If SSML provided explicitly, send ssml instead of prompt/text
        input = { ssml: extras.ssmlContent };
      } else if (extras.ssml) {
        const instruction = extras.instruction ?? "";
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const ssmlBody = `${instruction ? `<p>${esc(instruction)}</p>` : ""}<p>${esc(sentence)}</p>`;
        input = { ssml: `<speak>${ssmlBody}</speak>` };
      }

      const voiceObj: any = { languageCode };
      if (model) voiceObj.modelName = model;
      // Support both `speaker` (example) and `voice` (existing)
      if (extras.speaker) voiceObj.name = extras.speaker;
      else if (extras.voice) voiceObj.name = extras.voice;

      const request = {
        input,
        voice: voiceObj,
        audioConfig: {
          audioEncoding: "LINEAR16" as const,
          pitch: extras.pitch ?? 0,
          speakingRate: extras.speed || 1.0,
        },
      };

      // If user requests a Gemini-like model, try HTTP Vertex-style request with explicit prompt/speaker
      if ((model && model.toString().toLowerCase().includes("gemini")) || (extras as any).useHttp) {
        try {
          const httpResp = await this.sendVertexTTSRequest({
            model: model,
            input: input,
            voice: voiceObj,
            audioConfig: request.audioConfig,
          });

          if (httpResp && httpResp.audioContent) {
            const audioBuffer = Buffer.from(httpResp.audioContent, "base64");
            console.log(`[GoogleCloud TTS - HTTP] Audio received: ${audioBuffer.length} bytes for "${sentence}"`);

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

            ffmpegProcess.stdin.write(audioBuffer);
            ffmpegProcess.stdin.end();

            ffmpegProcess.stderr.on("data", (data) => {
              console.error(`[FFmpeg] ${data}`);
            });

            return [new Payload(ffmpegProcess.stdout, sentence, GoogleCloudProvider.NAME, extras)];
          }
        } catch (e) {
          console.warn("Vertex HTTP TTS attempt failed, falling back to client library:", e);
          // fall through to client synthesizeSpeech
        }
      }

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
    const { sentence } = payload;
    const language = payload.extras.language;
    const model = payload.extras.model;
    const speed = payload.extras.speed;
    const voice = payload.extras.speaker ?? payload.extras.voice;

    return `(Google Cloud): Saying "${sentence}" with model ${model} voice ${voice} (${language}) at speed ${speed} in guild ${guild.name}.`;
  }

  private async sendVertexTTSRequest(body: any): Promise<any> {
    // Try to obtain access token via service account JSON pointed by GOOGLE_APPLICATION_CREDENTIALS
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!saPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set for HTTP TTS request");

    const saJson = JSON.parse(fs.readFileSync(saPath, "utf8"));
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: saJson.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encode = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${encode(header)}.${encode(payload)}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(saJson.private_key, "base64url");
    const jwt = `${unsigned}.${signature}`;

    // Exchange JWT for access token
    const tokenResp = await new Promise<any>((resolve, reject) => {
      const postData = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString();
      const req = https.request(
        "https://oauth2.googleapis.com/token",
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(postData) } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
            else reject(new Error(`Token request failed ${res.statusCode}: ${data}`));
          });
        },
      );
      req.on("error", reject);
      req.write(postData);
      req.end();
    });

    const accessToken = tokenResp.access_token;
    if (!accessToken) throw new Error("No access token from service account JWT exchange");

    // Call TTS endpoint. Use v1 endpoint as a default; models may differ per project/region.
    const endpoint = "https://texttospeech.googleapis.com/v1/text:synthesize";

    const resp = await new Promise<any>((resolve, reject) => {
      const req = https.request(
        endpoint,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
            else reject(new Error(`TTS request failed ${res.statusCode}: ${data}`));
          });
        },
      );

      req.on("error", reject);
      req.write(JSON.stringify(body));
      req.end();
    });

    return resp;
  }
}