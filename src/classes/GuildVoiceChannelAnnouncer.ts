import {
  Collection,
  VoiceState,
  VoiceStateManager,
  type Guild,
  type VoiceBasedChannel,
} from "discord.js";
import { TTSPlayerImpl } from "./TTSAudioPlayer";
import type { LanguageCode, TTSPlayer } from "./tts-stuff";
import { GoogleProvider } from "./GoogleProvider";
import voiceStateUpdate from "@events/voice-state-update";
import { entersState, VoiceConnectionStatus } from "@discordjs/voice";

type GuildVoiceChannelAnnouncer = TTSPlayer;

const guildAnnouncerCache = new Collection<
  Guild["id"],
  GuildVoiceChannelAnnouncer | null | undefined
>();

const guildPreferredLanguages = new Collection<Guild["id"], LanguageCode>();

type VoiceStateWithChannel = VoiceState & {
  channel: Exclude<VoiceState["channel"], null>;
};

/** Tracks guild. Will automatically spawn and despawn announcer when someone joins a channel */
export function subscribeToGuild(guildId: Guild["id"]) {
  guildAnnouncerCache.set(guildId, null);
  return () => getAnnouncer(guildId);
}

export function unsubscribeFromGuild(guildId: Guild["id"]) {
  const announcer = guildAnnouncerCache.get(guildId);
  guildAnnouncerCache.delete(guildId);
  announcer?.destroy();
}

export function getAnnouncer(
  guildId: Guild["id"],
): GuildVoiceChannelAnnouncer | undefined | null {
  return guildAnnouncerCache.get(guildId);
}

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
) {
  const member = oldState.member ?? newState.member;
  if (!member?.guild.id || !guildAnnouncerCache.has(member.guild.id)) {
    console.log("Not a relevant guild or member");
    return;
  }
  if (member.user.id == oldState.client.user.id) return; // ignore self

  if (!member.user || member.user.bot) {
    console.log("User is bot, ignore");
    return;
  }

  if (!hasChannel(oldState) && hasChannel(newState)) {
    return onMemberConnect(newState);
  } else if (!hasChannel(newState) && hasChannel(oldState)) {
    return onMemberDisconnect(oldState);
  } else if (hasChannel(oldState) && hasChannel(newState)) {
    return onMemberChangedChannel(oldState, newState);
  }

  console.error("Failed to handle voice state update");
}

function hasChannel(state: VoiceState): state is VoiceStateWithChannel {
  return state.channel != null;
}

async function onMemberDisconnect(oldState: VoiceStateWithChannel) {
  console.log(
    `${oldState.member?.user.displayName} left channel${oldState.channel.name}`,
  );

  const announcer = getAnnouncer(oldState.guild.id);
  if (!announcer) return;
  if (!announcerIsOnChannel(oldState.channel)) return;

  // Connection Handling
  {
    const fetchedChannel = await oldState.channel.fetch();
    const otherNonBotMembers = fetchedChannel.members.filter(
      (m) => !m.user.bot && m.user.id != oldState.client.user?.id,
    );
    if (otherNonBotMembers.size == 0) {
      destroyTTSPlayer(oldState.guild);
    }
  }

  // Announcement Handling
  if (announcer) {
    // Announcement Handling
    announcer.languageCode =
      guildPreferredLanguages.get(announcer.guild!.id!) || "en";
    await announcer?.play(
      makeUserLeftMessage(oldState, announcer.languageCode),
    );
  }
}

async function onMemberConnect(newState: VoiceStateWithChannel) {
  let announcer = getAnnouncer(newState.guild.id);

  console.log(
    `${newState.member?.user.displayName} left channel${newState.channel.name}`,
  );

  // Connection Handling
  if (!announcer) {
    if (!newState.member?.user.bot) {
      announcer = await createTTSPlayer(newState.guild, newState.channel);
    }
    // Ignore bots
  } else {
    // Already connected
  }

  if (announcer && announcerIsOnChannel(newState.channel)) {
    // Announcement Handling
    announcer.languageCode =
      guildPreferredLanguages.get(announcer.guild!.id!) || "en";
    await announcer?.play(
      makeUserJoinedMessage(newState, announcer.languageCode),
    );
  }
}

async function onMemberChangedChannel(
  oldState: VoiceStateWithChannel,
  newState: VoiceStateWithChannel,
) {
  if (oldState.channelId == newState.channelId) return; // Ignore events like deafen and mute

  console.log(
    `${oldState.member?.user.displayName} changed channel ${oldState.channel.name} -> ${newState.channel.name}`,
  );

  // follow if left alone
  await onMemberDisconnect(oldState);
  await onMemberConnect(newState);
}

export async function createTTSPlayer(
  guild: Guild,
  channel: VoiceBasedChannel,
): Promise<TTSPlayer> {
  const player = new TTSPlayerImpl({
    tts: new GoogleProvider(),
  });

  console.log("Connecting...");
  await player.connect({ guild, channel });
  guildAnnouncerCache.set(guild.id, player);
  console.log(`Create TTS Player in ${guild?.name}:${channel?.name}`);

  player.connection?.on(VoiceConnectionStatus.Disconnected, () => {
    console.log("Disconnected.");
    player?.destroy();
    guildAnnouncerCache.set(guild.id, null);
  });
  console.log("...Connected");
  return player;
}

export function destroyTTSPlayer(guild: Guild): void {
  const player = getAnnouncer(guild.id);

  if (player) {
    const guild = player?.guild;
    const channel = player?.guild;
    player?.destroy();
    console.log(`Removed TTS Player from ${guild?.name}:${channel?.name}`);
  }

  guildAnnouncerCache.set(guild.id, null);
}

function announcerIsOnChannel(channel: VoiceBasedChannel) {
  const announcer = getAnnouncer(channel.guildId);
  if (!announcer) return false;
  return announcer.channel?.id == channel.id;
}

function makeUserLeftMessage(
  vs: VoiceStateWithChannel,
  language: LanguageCode = "en",
) {
  const displayName = vs.member?.user.displayName;
  switch (language) {
    case "en":
      return `${displayName} left your channel.`;
    case "vi-VN":
      return `${displayName} đã rời khỏi Channel của bạn.`;
    default:
      throw new Error("Invalid language code");
  }
}

function makeUserJoinedMessage(
  vs: VoiceStateWithChannel,
  language: LanguageCode = "en",
) {
  const displayName = vs.member?.user.displayName;
  switch (language) {
    case "en":
      return `${displayName} joined your channel.`;
    case "vi-VN":
      return `${displayName} đã tham gia channel của bạn.`;
    default:
      throw new Error("Invalid language code");
  }
}

export function setLang(guildId: Guild["id"], l: LanguageCode): void {
  guildPreferredLanguages.set(guildId, l);
}

export function getLang(guildId: Guild["id"]) {
  return guildPreferredLanguages.get(guildId);
}
