import type { Events } from "discord.js";

export type AnyAsyncVoid = (...any: any[]) => Promise<void>;

export type EventHandlerConfig<
  T,
  F extends (...any: any[]) => Promise<void>,
> = {
  event: Events;
  listener: F;
};
