import { Collection } from "discord.js";

import join from "./join";
import ping from "./ping";
import setLogChannel from "./set-log-channel";
import sayTTS from "./say-tts";
import setLang from "./setLanguage";

import type { ChatCommand } from "./type";

export const commands = new Collection<string, ChatCommand>();

[join, ping, setLogChannel, sayTTS, setLang].forEach((cmd: ChatCommand) => {
  commands.set(cmd.data.name, cmd);
});
