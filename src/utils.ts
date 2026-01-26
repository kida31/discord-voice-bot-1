import { REST, Routes } from "discord.js";
import { commands as fullCommandData } from "./commands";
import { clientId, devGuildId, token } from "config";

const commands = fullCommandData.map((c) => c.data.toJSON());
const rest = new REST().setToken(token);

export async function deployCommands(global: boolean = false) {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    if (global) {
      const data = await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });

      console.log(
        `Successfully reloaded ${data?.length} application (/) commands globally`,
      );
    } else {
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, devGuildId),
        { body: commands },
      );

      console.log(
        `Successfully reloaded ${data?.length} application (/) commands. In ${devGuildId}`,
      );
    }
  } catch (error) {
    console.error(error);
  }
}
