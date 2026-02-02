import { commands } from "@commands/index";
import type { Interaction, CacheType } from "discord.js";

export default function interactionCreateListener(
  itx: Interaction<CacheType>,
): void {
  if (!itx.isChatInputCommand()) return;

  const cmd = commands.get(itx.commandName);
  if (!cmd) return;

  console.log(itx.user.username, "triggered", cmd?.data.name);
  cmd?.execute(itx);
}
