import { Collection } from "discord.js";

import join from "./join";
import ping from "./ping";
import say from "./say";
import setLanguage from "./set-language";
import setChannel from "./set-tts-channel";
import type { BaseCommand } from "./type";

export const commands = new Collection<string, BaseCommand<any>>();

// TODO pick from directory
[join, ping, say, setLanguage, setChannel].forEach((cmd: BaseCommand<any>) => {
  commands.set(cmd.data.name, cmd);
});
