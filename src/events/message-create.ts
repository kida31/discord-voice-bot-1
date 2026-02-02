import { Events, type OmitPartialGroupDMChannel, Message } from "discord.js";
import type { EventHandlerConfig } from "./type";
import { handleTextInputInChannel } from "classes/tts/SpokenChannel";

export type MessageCreateHandler = (
  message: OmitPartialGroupDMChannel<Message<boolean>>,
) => Promise<void>;

export default {
  event: Events.MessageCreate,
  async listener(message) {
    handleTextInputInChannel(message);
  },
} satisfies EventHandlerConfig<Events.MessageCreate, MessageCreateHandler>;
