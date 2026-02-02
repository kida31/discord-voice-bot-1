import type {
  OmitPartialGroupDMChannel,
  Message,
  CacheType,
  Interaction,
  VoiceState,
} from "discord.js";

export type MessageCreateHandler = (
  message: OmitPartialGroupDMChannel<Message<boolean>>,
) => void;

export type InteractionCreateHandler = (
  interaction: Interaction<CacheType>,
) => void;

export type VoiceStateUpdateHandler = (
  oldState: VoiceState,
  newState: VoiceState,
) => void;
