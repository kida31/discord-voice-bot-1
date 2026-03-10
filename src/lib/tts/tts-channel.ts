import type {MessageCreateHandler} from "@events/type";
import {getAnnouncer} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {Collection, Guild, type GuildTextBasedChannel, type TextBasedChannel,} from "discord.js";
import {getUserVoiceChannel} from "../../utils";

// ---- INTERNAL CONFIG ----

const AUTHOR_IN_CHANNEL_REQUIRED: boolean = false;

// ---- INTERNAL STATE ----

const trackedChannels: Collection<Guild["id"], TextBasedChannel["id"]> =
    new Collection();

// ---- PUBLIC HELPER FUNCTION ----

export const handleAutoTtsChannel: MessageCreateHandler = async function (msg) {
    if (!msg.inGuild()) {
        console.log("Not a guild message");
        return;
    }

    if (msg.member?.user.id == msg.guild.members.me!.id) {
        return; // ignore own messages
    }

    if (!msg.member || !msg.member.user) {
        console.log("Not a member user");
        return; // i do not frigging know what kind of scenario that is
    }

    const {content, channelId} = msg;
    if (trackedChannels.get(msg.guildId) != channelId) return;

    const announcer = getAnnouncer(msg.guildId);

    if (!announcer) {
        console.log("No announcer active");
        return;
    }

    if (AUTHOR_IN_CHANNEL_REQUIRED) {
        const authorChannel = await getUserVoiceChannel(msg.guild, msg.member.user);
        if (!authorChannel || authorChannel.id !== announcer.channel?.id) {
            // author is not in channel
            return;
        }
    }

    await announcer.play(content);
};

export function setReadChannel(channel: GuildTextBasedChannel) {
    trackedChannels.set(channel.guildId, channel.id);
}
