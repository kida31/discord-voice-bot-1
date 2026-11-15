import {
    Collection,
    type Guild,
    GuildMember,
    type VoiceBasedChannel,
    VoiceState,
} from "discord.js";
import {TTSPlayerImpl} from "./TTSAudioPlayer";
import type {TTSPlayer} from "./types";
import {VoiceConnectionStatus} from "@discordjs/voice";
import {langByKey, type LanguageKey} from "@lib/tts/localization/lang";
import {
    type SupportedLanguageKey,
    translate,
} from "@lib/tts/localization/text";
import {voiceById} from "@lib/tts/audio-provider/eleven-labs/voices";
import {
    ElevenLabsProvider,
    GoogleTranslateTTS,
} from "@lib/tts/audio-provider";
import {
    type GuildAnnouncerConfig,
    GuildAnnouncerConfigRepository,
} from "@lib/persist/GuildAnnouncerConfigRepository";
import type {VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";

type GuildVoiceChannelAnnouncer = TTSPlayer;

const guildAnnouncerCache = new Collection<
    Guild["id"],
    GuildVoiceChannelAnnouncer | null | undefined
>();

type VoiceStateWithChannel = VoiceState & {
    channel: Exclude<VoiceState["channel"], null>;
};

/**
 * Tracks a guild.
 * Automatically creates and destroys the announcer when members
 * join or leave a voice channel.
 */
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

    if (
        !member?.guild.id ||
        !guildAnnouncerCache.has(member.guild.id)
    ) {
        console.log("Not a relevant guild or member");
        return;
    }

    // Ignore voice-state updates produced by the bot itself.
    if (member.user.id === oldState.client.user.id) {
        return;
    }

    // Ignore other bots.
    if (member.user.bot) {
        console.log("User is bot, ignore");
        return;
    }

    if (!hasChannel(oldState) && hasChannel(newState)) {
        await onMemberConnect(newState);
        return;
    }

    if (!hasChannel(newState) && hasChannel(oldState)) {
        await onMemberDisconnect(oldState);
        return;
    }

    if (hasChannel(oldState) && hasChannel(newState)) {
        await onMemberChangedChannel(oldState, newState);
        return;
    }

    console.error("Failed to handle voice state update");
}

function hasChannel(
    state: VoiceState,
): state is VoiceStateWithChannel {
    return state.channel !== null;
}

async function onMemberDisconnect(
    oldState: VoiceStateWithChannel,
) {
    console.log(
        `${oldState.member?.user.displayName} left channel ${oldState.channel.name}`,
    );

    const announcer = getAnnouncer(oldState.guild.id);

    if (!announcer) {
        return;
    }

    if (!announcerIsOnChannel(oldState.channel)) {
        return;
    }

    /*
     * Play the leave announcement before potentially destroying
     * the player. This keeps the existing provider and configured
     * ElevenLabs voice alive while the audio is generated.
     */
    await announcer.play(
        translate(
            getGuildTextLanguage(oldState.guild.id),
            "leave",
            getMemberNickname(oldState.member!),
        ),
    );

    /*
     * Only destroy the player after the announcement has been
     * submitted for playback and nobody else is left in the channel.
     */
    const fetchedChannel = await oldState.channel.fetch();

    const otherNonBotMembers = fetchedChannel.members.filter(
        (member) =>
            !member.user.bot &&
            member.user.id !== oldState.client.user?.id,
    );

    if (otherNonBotMembers.size === 0) {
        destroyTTSPlayer(oldState.guild);
    }
}

async function onMemberConnect(
    newState: VoiceStateWithChannel,
) {
    let announcer = getAnnouncer(newState.guild.id);

    console.log(
        `${newState.member?.user.displayName} joined channel ${newState.channel.name}`,
    );

    if (!announcer) {
        announcer = await createTTSPlayer(
            newState.guild,
            newState.channel,
        );
    }

    if (
        announcer &&
        announcerIsOnChannel(newState.channel)
    ) {
        await announcer.play(
            translate(
                getGuildTextLanguage(newState.guild.id),
                "join",
                getMemberNickname(newState.member!),
            ),
        );
    }
}

async function onMemberChangedChannel(
    oldState: VoiceStateWithChannel,
    newState: VoiceStateWithChannel,
) {
    // Ignore events such as mute, unmute, deafen and undeafen.
    if (oldState.channelId === newState.channelId) {
        return;
    }

    console.log(
        `${oldState.member?.user.displayName} changed channel `
        + `${oldState.channel.name} -> ${newState.channel.name}`,
    );

    await onMemberDisconnect(oldState);
    await onMemberConnect(newState);
}

function createTTSProvider(
    config: GuildAnnouncerConfig,
) {
    console.log(
        "Creating TTS provider with config",
        config,
    );

    if (config.elevenLabsVoiceId) {
        const voice = voiceById(
            config.elevenLabsVoiceId,
        );

        const language = langByKey(
            config.voiceLanguage,
        );

        const compatibleLanguages =
            voice.compatibleLanguages ?? [];

        const isLanguageValid =
            compatibleLanguages.includes(language.subtag);

        /*
         * Use the configured language when it is supported by the
         * selected voice. Otherwise use the first language supported
         * by that voice.
         */
        const languageCode = isLanguageValid
            ? language.subtag
            : compatibleLanguages[0];

        if (!languageCode) {
            throw new Error(
                `No compatible language found for ElevenLabs voice `
                + `${config.elevenLabsVoiceId}`,
            );
        }

        return new ElevenLabsProvider({
            voiceId: config.elevenLabsVoiceId,
            language_code: languageCode,
        });
    }

    return new GoogleTranslateTTS({
        language: config.voiceLanguage,
    });
}

export async function createTTSPlayer(
    guild: Guild,
    channel: VoiceBasedChannel,
): Promise<TTSPlayer> {
    const config =
        new GuildAnnouncerConfigRepository()
            .getConfig(guild.id);

    const player = new TTSPlayerImpl({
        tts: createTTSProvider(config),
    });

    console.log(
        `Connecting... (${guild.name}, ${channel.name})`,
    );

    await player.connect({
        guild,
        channel,
    });

    guildAnnouncerCache.set(
        guild.id,
        player,
    );

    console.log(
        `Create TTS Player in ${guild.name}:${channel.name}`,
    );

    player.connection?.on(
        VoiceConnectionStatus.Disconnected,
        () => {
            console.log("Disconnected.");

            player.destroy();
            guildAnnouncerCache.set(guild.id, null);
        },
    );

    console.log("...Connected");

    return player;
}

export function destroyTTSPlayer(
    guild: Guild,
): void {
    const player = getAnnouncer(guild.id);

    if (player) {
        const playerGuild = player.guild;
        const playerChannel = player.channel;

        player.destroy();

        console.log(
            `Removed TTS Player from `
            + `${playerGuild?.name ?? guild.name}:`
            + `${playerChannel?.name ?? "unknown channel"}`,
        );
    }

    guildAnnouncerCache.set(guild.id, null);
}

export async function updateTTSPlayer(
    guild: Guild,
) {
    const player = getAnnouncer(guild.id);

    if (!player) {
        return;
    }

    const channel = player.channel;

    if (!channel) {
        return;
    }

    destroyTTSPlayer(guild);

    await createTTSPlayer(
        guild,
        channel,
    );
}

function announcerIsOnChannel(
    channel: VoiceBasedChannel,
) {
    const announcer = getAnnouncer(
        channel.guildId,
    );

    if (!announcer) {
        return false;
    }

    return announcer.channel?.id === channel.id;
}

export function setGuildVoiceLanguage(
    guildId: Guild["id"],
    language: LanguageKey,
): void {
    const repository =
        new GuildAnnouncerConfigRepository();

    repository.updateConfig({
        guildId,
        voiceLanguage: language,
        elevenLabsVoiceId: null,
    });
}

export function getGuildVoiceLanguage(
    guildId: Guild["id"],
): LanguageKey {
    const repository =
        new GuildAnnouncerConfigRepository();

    return repository
        .getConfig(guildId)
        .voiceLanguage;
}

export function setGuildTextLanguage(
    guildId: Guild["id"],
    language: SupportedLanguageKey,
): void {
    const repository =
        new GuildAnnouncerConfigRepository();

    repository.updateConfig({
        guildId,
        textLanguage: language,
    });
}

export function getGuildTextLanguage(
    guildId: Guild["id"],
): SupportedLanguageKey {
    const repository =
        new GuildAnnouncerConfigRepository();

    return repository
        .getConfig(guildId)
        .textLanguage;
}

export function setGuildVoiceModel(
    guildId: Guild["id"],
    voiceId: VoiceId | null,
): void {
    const repository =
        new GuildAnnouncerConfigRepository();

    repository.updateConfig({
        guildId,
        elevenLabsVoiceId: voiceId,
    });
}

export function getGuildVoiceModel(
    guildId: Guild["id"],
): VoiceId | null {
    const repository =
        new GuildAnnouncerConfigRepository();

    return repository
        .getConfig(guildId)
        .elevenLabsVoiceId;
}

function getMemberNickname(
    member: GuildMember,
): string {
    const config =
        new GuildAnnouncerConfigRepository()
            .getConfig(member.guild.id);

    const alias =
        config.aliases[member.user.id];

    return (
        alias ??
        member.nickname ??
        member.user.displayName ??
        "User"
    );
}