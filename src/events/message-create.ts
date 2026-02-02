import { type OmitPartialGroupDMChannel, Message } from "discord.js";
import { handleAutoTtsChannel } from "@lib/tts/tts-channel";

export default async function messageCreateListener(
  message: OmitPartialGroupDMChannel<Message<boolean>>,
) {
  handleAutoTtsChannel(message);
}
