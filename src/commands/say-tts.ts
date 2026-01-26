import {
  AudioPlayer,
  createAudioResource,
  getVoiceConnection,
} from "@discordjs/voice";
import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { GoogleProvider } from "./GoogleProvider";
import type { ChatCommand } from "./type";

// import ffmpeg from "ffmpeg-static";
// console.log("Using FFmpeg at:", ffmpeg);
const data = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Say something with tts")
  .addStringOption((option) =>
    option.setName("text").setDescription("Say something").setRequired(true),
  );

async function execute(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const text = interaction.options.getString("text", true);

  const player = new AudioPlayer();
  const payloads = await (async function () {
    const provider = new GoogleProvider();
    return provider.createPayload(text, { language: "en" });
  })();

  const payload = payloads[0]!;
  console.log(payload);

  const connection = getVoiceConnection(interaction.guildId!);

  if (connection) {
    connection?.subscribe(player);
    const res = createAudioResource(payload.resource, {
      metadata: {
        title: payload.sentence,
      },
    });
    player.play(res);
  }
}

export default {
  data,
  execute,
  run: execute,
} satisfies ChatCommand;
