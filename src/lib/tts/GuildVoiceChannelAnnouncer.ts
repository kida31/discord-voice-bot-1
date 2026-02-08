import {
  Collection,
  GuildMember,
  VoiceState,
  type Guild,
  type VoiceBasedChannel,
} from "discord.js";
import { TTSPlayerImpl } from "./TTSAudioPlayer";
import type { LanguageCode, TTSPlayer } from "./tts-stuff";
import { VoiceConnectionStatus } from "@discordjs/voice";
import { GoogleCloudProvider } from "./audio-provider/GoogleCloudProvider";
import { getAlias } from "./member-alias";
import { memberJoinedChannel, memberLeftChannel } from "./announcer-phrases";
import type { KeyValueOperations } from "@lib/common/util-types";
import { PersistedMap } from "@lib/persist/PersistedMap";

type GuildVoiceChannelAnnouncer = TTSPlayer;

const guildAnnouncerCache = new Collection<
  Guild["id"],
  GuildVoiceChannelAnnouncer | null | undefined
>();

type VoiceStateWithChannel = VoiceState & {
  channel: Exclude<VoiceState["channel"], null>;
};

const DEFAULT_TEXT_LANG: LanguageCode = "en-US";
const DEFAULT_VOICE_LANG: LanguageCode = "en-US";

const baseKey = "tts";
const guildKey = (guildId: string) => `${baseKey}/${guildId}`;

export function configureGVCAnnouncer(options: {
  persist: {
    text: KeyValueOperations<string, string>;
    voice: KeyValueOperations<string, string>;
  };
}) {
  _guildTextLanguageMap = new PersistedMap<Guild["id"], LanguageCode>({
    persistance: options.persist.text,
    toStringKey: (guildId: string) => `${guildKey(guildId)}/text/lang`,
    toStringValue: (l) => l,
  });

  _guildVoiceLanguageMap = new PersistedMap<Guild["id"], LanguageCode>({
    persistance: options.persist.voice,
    toStringKey: (guildId: string) => `${guildKey(guildId)}/voice/lang`,
    toStringValue: (l) => l,
  });
}

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
    announcer.languageCode = getGuildVoiceLanguage(announcer.guild!.id!);
    await announcer?.play(
      memberLeftChannel(
        memberName(oldState.member!),
        getGuildTextLanguage(oldState.guild.id),
      ),
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
    announcer.languageCode = getGuildVoiceLanguage(announcer.guild!.id!);
    await announcer?.play(
      memberJoinedChannel(
        memberName(newState.member!),
        getGuildTextLanguage(newState.guild.id),
      ),
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
    tts: new GoogleCloudProvider(),
  });

  if (getGuildVoiceLanguage(guild.id)) {
    player.languageCode = getGuildVoiceLanguage(guild.id)!;
  }

  console.log(`Connecting... (${guild.name}, ${channel.name})`);
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

let _guildVoiceLanguageMap: KeyValueOperations<Guild["id"], LanguageCode> =
  new Map();
let _guildTextLanguageMap: KeyValueOperations<Guild["id"], LanguageCode> =
  new Map();

export function setGuildVoiceLanguage(
  guildId: Guild["id"],
  l: LanguageCode,
): void {
  _guildVoiceLanguageMap.set(guildId, l);

  const announcer = getAnnouncer(guildId);
  if (announcer) {
    announcer.languageCode = l;
  }
}

export function getGuildVoiceLanguage(guildId: Guild["id"]): LanguageCode {
  return _guildVoiceLanguageMap.get(guildId) ?? DEFAULT_VOICE_LANG;
}

export function setGuildTextLanguage(
  guildId: Guild["id"],
  l: LanguageCode,
): void {
  _guildTextLanguageMap.set(guildId, l);
}

export function getGuildTextLanguage(guildId: Guild["id"]): LanguageCode {
  return _guildTextLanguageMap.get(guildId) ?? DEFAULT_TEXT_LANG;
}

function memberName(member: GuildMember): string {
  return (
    getAlias(member.guild.id, member.user.id) ??
    member.nickname ??
    member.user.displayName ??
    "User"
  );
}
