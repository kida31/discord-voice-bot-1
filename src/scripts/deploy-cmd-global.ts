import {deployGlobalCommands} from "../deploy-commands";
import {commands} from "@commands/index";

const commandData = commands.map((c) => c.data.toJSON())
await deployGlobalCommands(commandData)