import dotenv from "dotenv";

dotenv.config();

function assertIsString(maybeString: any): string | never {
  if (typeof maybeString == "string") {
    return maybeString;
  }

  throw new Error("Expected string, got something else");
}

export const token = assertIsString(process.env.DISCORD_BOT_TOKEN);
export const clientId = assertIsString(process.env.CLIENT_ID);
export const devGuildId = assertIsString(process.env.DEV_GUILD_ID);
