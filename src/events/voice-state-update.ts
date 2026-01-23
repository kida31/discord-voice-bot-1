import { guildToLogChannel } from "@commands/set-log-channel";
import { getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import { Events, Guild, VoiceState, type ClientEvents } from "discord.js";
type a = ClientEvents[Events.VoiceStateUpdate];

// export const VoiceStateUpdateHandler = {
export default {
  event: Events.VoiceStateUpdate,
  async listener(oldState: VoiceState, newState: VoiceState) {
    const user = oldState.member?.user ?? newState.member?.user;
    if (!user || user.bot) return;

    if (oldState.channelId == null) {
      return OnUserFreshConnect(newState);
    }

    if (newState.channelId == null) {
      return OnUserFinalDisconnect(oldState);
    }

    // Changed channel
    logMessage(
      oldState.guild,
      `${oldState.member?.user.displayName} changed from ${oldState.channel} to ${newState.channel}.`,
    );
  },
} as const;

async function OnUserFinalDisconnect(oldState: VoiceState) {
  // Log user left
  {
    logMessage(
      oldState.guild,
      `${oldState.member?.user.displayName} disconnected from ${oldState.channel}.`,
    );
  }

  const connection = getVoiceConnection(oldState.guild.id);

  // Leave if left alone
  {
    if (!connection) {
      console.log("Im not connected to begin with.");
      return;
    }

    // Leave channel if last person in current channel
    const myVoiceChannel = oldState.guild.members.me?.voice.channel!;
    // const myVoiceChannel = oldState.channel!;
    const fetchedChannel = await myVoiceChannel.fetch();
    const meTheBot = oldState.client.user;
    const members = fetchedChannel.members.filter(
      (m) => !m.user.bot && m.user.id != meTheBot.id,
    );
    // console.log(fetchedChannel.members.mapValues((v) => v.user.username));

    if (members.size == 0) {
      console.log("There is no1 left here. Time to leave...");
      connection?.destroy();
    }
  }
}

async function OnUserFreshConnect(newState: VoiceState) {
  {
    logMessage(
      newState.guild,
      `${newState.member?.user.displayName} connected to ${newState.channel}.`,
    );
  }

  const connection = getVoiceConnection(newState.guild.id);
  if (!!connection) {
    console.log("Im already connected");
    return;
  }

  const thatVoiceChannel = newState.channel!;
  const fetchedChannel = await thatVoiceChannel.fetch();
  const thatUser = newState.member?.user!;
  const members = fetchedChannel.members.filter(
    (m) => !m.user.bot && m.user.id != thatUser.id,
  );

  if (members.size == 0) {
    console.log(`${thatUser.username} seems so lonely... I will join`);
    joinVoiceChannel({
      channelId: thatVoiceChannel.id,
      guildId: thatVoiceChannel.guild.id,
      adapterCreator: thatVoiceChannel.guild.voiceAdapterCreator,
    });
  }
}

async function logMessage(guild: Guild, message: string) {
  const logChannelId = guildToLogChannel.get(guild.id);
  if (!logChannelId) return;

  const logChannel = await guild.channels.fetch(logChannelId);

  if (!!logChannel && logChannel.isTextBased()) {
    logChannel.send(message);
  }
}
