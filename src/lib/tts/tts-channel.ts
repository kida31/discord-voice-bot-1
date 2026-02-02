import type { MessageCreateHandler } from "@events/type";
import { getAnnouncer } from "@lib/tts/GuildVoiceChannelAnnouncer";
import {
  Collection,
  Guild,
  type GuildTextBasedChannel,
  type TextBasedChannel,
} from "discord.js";

const trackedChannels: Collection<Guild["id"], TextBasedChannel["id"]> =
  new Collection();

export const handleAutoTtsChannel: MessageCreateHandler = async function (msg) {
  if (!msg.inGuild()) {
    console.log("Not a guild message");
    return;
  }

  if (msg.member?.user.id == msg.guild.members.me!.id) {
    return; // ignore own messages
  }

  const { content, channelId } = msg;
  if (trackedChannels.get(msg.guildId) != channelId) return;

  const announcer = getAnnouncer(msg.guildId);
  // TODO assert user is also in channel
  if (!announcer) {
    console.log("No announcer active");
    return;
  }
  announcer.play(content);
};

export function setReadChannel(channel: GuildTextBasedChannel) {
  trackedChannels.set(channel.guildId, channel.id);
}
