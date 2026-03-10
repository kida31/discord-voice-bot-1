import {REST, Routes, type SlashCommandBuilder} from "discord.js";
import {clientId, token} from "config";

type CommandBody = ReturnType<SlashCommandBuilder["toJSON"]>

export async function deployGuildCommands(commands: CommandBody[], guildId: string) {
    const rest = new REST().setToken(token);

    console.log(`Deploying ${commands.length} application (/) commands in guild (${guildId})...`);
    const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {body: commands},) as [];
    console.log(`Successfully reloaded ${data?.length} application (/) commands. In guild (${guildId})`);
}

export async function deployGlobalCommands(commands: CommandBody[]) {
    const rest = new REST().setToken(token);

    console.log(`Deploying ${commands.length} application (/) commands globally...`);
    const data = await rest.put(Routes.applicationCommands(clientId), {body: commands,}) as [];
    console.log(`Successfully reloaded ${data?.length} application (/) commands globally`);
}