import {deployGlobalCommands, deployGuildCommands} from "../deploy-commands";
import {devGuildId} from "../config";
import {commands} from "@commands/index";

const commandData = commands.map((c) => c.data.toJSON())

await deployGuildCommands(commandData, devGuildId) // Deploy for guild first to force refresh
await deployGlobalCommands(commandData) // Deploy globally, will work instantly for guild
await deployGuildCommands([], devGuildId) // Remove guild-only versions of commands