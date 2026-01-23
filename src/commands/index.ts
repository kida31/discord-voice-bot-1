import { Collection } from "discord.js";

import join from "./voice/join";
import ping from "./utility/ping";
import type { ChatCommand } from "./type";

export const commands = new Collection<string, ChatCommand>();

[join, ping].forEach((cmd: ChatCommand) => {
  commands.set(cmd.data.name, cmd);
});
