import { type OmitPartialGroupDMChannel, Message } from "discord.js";
import { handleTextInputInChannel } from "@lib/tts/tts-channel";

export default async function messageCreateListener(
  message: OmitPartialGroupDMChannel<Message<boolean>>,
) {
  handleTextInputInChannel(message);
}
