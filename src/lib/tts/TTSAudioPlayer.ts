import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  PlayerSubscription,
  VoiceConnection,
  VoiceConnectionStatus,
  type VoiceConnectionState,
} from "@discordjs/voice";
import { type Guild, type VoiceBasedChannel } from "discord.js";
import { FIFOQueue } from "../common/FIFOQueue";
import type { LanguageCode, Payload, TTSPlayer, TTSService } from "./tts-stuff";

type PayloadWithResource = {
  payload: Payload;
  resource: AudioResource;
};
export class TTSPlayerImpl implements TTSPlayer {
  player: AudioPlayer;
  tts: TTSService;

  guild: Guild | undefined;
  channel: VoiceBasedChannel | undefined;
  connection: VoiceConnection | undefined;

  languageCode: LanguageCode = "en-US";

  private queue: FIFOQueue<PayloadWithResource> = new FIFOQueue();
  private subscription: PlayerSubscription | undefined;

  constructor(options: { tts: TTSService }) {
    const { tts } = options;

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    }).on(AudioPlayerStatus.Idle, () => {
      const next = this.queue.dequeue();
      if (!!next) this.player.play(next.resource);
    });

    this.tts = tts!;
  }

  async connect({
    guild,
    channel,
  }: {
    guild: Guild;
    channel: VoiceBasedChannel;
  }) {
    this.channel = channel;
    this.guild = guild;
    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    const logConnectionAttempt = (
      oldState: VoiceConnectionState,
      newState: VoiceConnectionState,
    ) => {
      if (newState.status == VoiceConnectionStatus.Ready) {
        this.connection?.removeListener("stateChange", logConnectionAttempt);
      }
      if (oldState.status == newState.status) {
        console.log(`${oldState.status}...`);
      } else {
        console.log(
          `Voice state changed: ${oldState.status} -> ${newState.status}`,
        );
      }
    };

    this.connection.on("stateChange", logConnectionAttempt);

    await entersState(this.connection, VoiceConnectionStatus.Ready, 5_000);
    this.subscription = this.connection.subscribe(this.player);

    return this.connection;
  }

  get isSpeaking(): boolean {
    return this.player.state.status == AudioPlayerStatus.Playing;
  }

  async play(text: string) {
    if (
      !this.guild ||
      !this.channel ||
      !this.connection ||
      !getVoiceConnection(this.guild.id)
    ) {
      console.error("TTS Player not connected to a guild/channel");
      return;
    }

    const payloads = await this.tts.create(text, {
      language: this.languageCode,
    });
    // console.log("Query result from tts service: []", payloads.length);
    for (const payload of payloads) {
      const resource = createAudioResource(
        payload.resource as any /*TODO: IDK WHAT TYPE HERE WORKS */,
        {
          metadata: { title: payload.sentence },
        },
      );
      if (this.isSpeaking) {
        this.queue.enqueue({ payload, resource });
      } else {
        this.forcePlay({ payload, resource });
      }
    }
  }

  private async forcePlay(item: PayloadWithResource) {
    console.log(
      `TTSAnnouncer said: "${item.payload.sentence}" in ${this.guild!.name}:${this.channel!.name}`,
    );
    this.player.play(item.resource);
  }

  destroy() {
    this.subscription?.unsubscribe();
    this.connection?.destroy();

    this.player.stop();
  }
}
