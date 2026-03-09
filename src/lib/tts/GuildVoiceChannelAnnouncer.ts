import {Collection, type Guild, GuildMember, type VoiceBasedChannel, VoiceState,} from "discord.js";
import {TTSPlayerImpl} from "./TTSAudioPlayer";
import type {TTSPlayer} from "./tts-stuff";
import {VoiceConnectionStatus} from "@discordjs/voice";
import {langByKey, type LanguageKey} from "@lib/tts/localization/lang";
import {type SupportedLanguageKey, translate} from "@lib/tts/localization/text";
import {byId} from "@lib/tts/audio-provider/eleven-labs/voices";
import {ElevenLabsProvider, GoogleTranslateTTS} from "@lib/tts/audio-provider";
import {type GuildAnnouncerConfig, GuildAnnouncerConfigRepository} from "@lib/persist/GuildAnnouncerConfigRepository";
import type {VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";

type GuildVoiceChannelAnnouncer = TTSPlayer;

const guildAnnouncerCache = new Collection<
    Guild["id"],
    GuildVoiceChannelAnnouncer | null | undefined
>();

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
        await announcer?.play(translate(getGuildTextLanguage(oldState.guild.id), "leave", getMemberNickname(oldState.member!)));
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
        await announcer?.play(translate(getGuildTextLanguage(newState.guild.id), "join", getMemberNickname(newState.member!))
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

function createTTSProvider(config: GuildAnnouncerConfig) {
    if (config.elevenLabsVoiceId) {
        const voice = byId(config.elevenLabsVoiceId);
        const language = langByKey(config.voiceLanguage);

        const compatibleLanguages = voice.compatibleLanguages ?? [];
        const isLangValid = compatibleLanguages.includes(language.subtag);
        // fallback to first compatible language if configured language is not compatible with the voice
        const langCode = isLangValid ? language.subtag : voice.compatibleLanguages[0]!;

        return new ElevenLabsProvider({
            voiceId: config.elevenLabsVoiceId,
            language_code: langCode,
        })
    } else {
        return new GoogleTranslateTTS({
            language: config.voiceLanguage,
        });
    }
}

export async function createTTSPlayer(
    guild: Guild,
    channel: VoiceBasedChannel,
): Promise<TTSPlayer> {
    const config = new GuildAnnouncerConfigRepository().getConfig(guild.id);
    const player = new TTSPlayerImpl({
        tts: createTTSProvider(config),
    });

    console.log(`Connecting... (${guild.name}, ${channel.name})`);
    await player.connect({guild, channel});
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

export async function updateTTSPlayer(guild: Guild) {
    const player = getAnnouncer(guild.id);
    if (!player) return;

    const channel = player.channel;
    if (!channel) return;

    destroyTTSPlayer(guild);
    await createTTSPlayer(guild, channel);
}
function announcerIsOnChannel(channel: VoiceBasedChannel) {
    const announcer = getAnnouncer(channel.guildId);
    if (!announcer) return false;
    return announcer.channel?.id == channel.id;
}

export function setGuildVoiceLanguage(guildId: Guild["id"], l: LanguageKey,): void {
    const rep = new GuildAnnouncerConfigRepository();
    rep.updateConfig({guildId, voiceLanguage: l, elevenLabsVoiceId: null});
}

export function getGuildVoiceLanguage(guildId: Guild["id"]): LanguageKey {
    const rep = new GuildAnnouncerConfigRepository();
    return rep.getConfig(guildId).voiceLanguage;
}

export function setGuildTextLanguage(guildId: Guild["id"], l: SupportedLanguageKey,): void {
    const rep = new GuildAnnouncerConfigRepository();
    rep.updateConfig({guildId, textLanguage: l,});
}

export function getGuildTextLanguage(guildId: Guild["id"]): SupportedLanguageKey {
    const rep = new GuildAnnouncerConfigRepository();
    return rep.getConfig(guildId).textLanguage;
}

export function setGuildVoiceModel(guildId: Guild["id"], voiceId: VoiceId | null): void {
    const rep = new GuildAnnouncerConfigRepository();
    rep.updateConfig({guildId, elevenLabsVoiceId: voiceId,});
}

export function getGuildVoiceModel(guildId: Guild["id"]): VoiceId | null {
    const rep = new GuildAnnouncerConfigRepository();
    return rep.getConfig(guildId).elevenLabsVoiceId;
}

function getMemberNickname(member: GuildMember): string {
    const alias = new GuildAnnouncerConfigRepository().getConfig(member.guild.id).aliases[member.user.id];
    return alias ?? member.nickname ?? member.user.displayName ?? "User";
}
