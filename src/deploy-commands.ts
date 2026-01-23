import { REST, Routes } from "discord.js";
import { commands as fullCommandData } from "./commands";
import { clientId, devGuildId, token } from "config";

const commands = fullCommandData.map((c) => c.data.toJSON());
const rest = new REST().setToken(token);

export async function deploy(global: boolean = false) {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      global
        ? Routes.applicationCommands(clientId)
        : Routes.applicationGuildCommands(clientId, devGuildId),
      { body: commands },
    );

    console.log(
      `Successfully reloaded ${data?.length} application (/) commands.`,
    );
  } catch (error) {
    console.error(error);
  }
}

deploy();
