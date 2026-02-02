import { type OmitPartialGroupDMChannel, Message } from "discord.js";
import { handleTextInputInChannel } from "classes/tts/tts-channel";

export default async function messageCreateListener(
  message: OmitPartialGroupDMChannel<Message<boolean>>,
) {
  handleTextInputInChannel(message);
}
