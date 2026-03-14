import {commands} from "@commands/index";
import {deployGuildCommands} from "../deploy-commands";
import {devGuildId} from "../config";

const commandData = commands.map((c) => c.data.toJSON())
await deployGuildCommands(commandData, devGuildId)