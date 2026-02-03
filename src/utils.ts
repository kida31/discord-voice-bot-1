import { Guild, REST, Routes, User } from "discord.js";
import { commands as fullCommandData } from "./commands";
import { clientId, devGuildId, token } from "config";

export async function deployCommands(global: boolean = false) {
  const globalCommands = fullCommandData.map((c) => c.data.toJSON());
  const guildCommands = global ? [] : globalCommands;
  const rest = new REST().setToken(token);

  try {
    console.log(
      `Started refreshing ${globalCommands.length} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    if (global) {
      const data = await rest.put(Routes.applicationCommands(clientId), {
        body: globalCommands,
      });

      console.log(
        `Successfully reloaded ${(data as [])?.length} application (/) commands globally`,
      );
    }

    {
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, devGuildId),
        { body: guildCommands },
      );

      console.log(
        `Successfully reloaded ${(data as [])?.length} application (/) commands. In ${devGuildId}`,
      );
    }
  } catch (error) {
    console.error(error);
  }
}

async function getUserVoiceChannel(guild: Guild, user: User) {
  const state = await guild.voiceStates.fetch(user);
  return state.channel;
}

export function popFirst<T>(list: T[]): [T | undefined, T[]] {
  if (list.length == 0) {
    return [undefined, []];
  }
  if (list.length == 1) {
    return [list[0]!, []];
  }
  const [item, ...rest] = list;
  return [item, rest];
}
