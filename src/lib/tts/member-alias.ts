import {Guild, User} from "discord.js";
import {GuildAnnouncerConfigRepository} from "@lib/persist/GuildAnnouncerConfigRepository";

export const ALIAS_MAX_LENGTH = 64;

export function setAlias(
    guildId: Guild["id"],
    userId: User["id"],
    alias: string,
): void {
    if (alias.length > ALIAS_MAX_LENGTH) {
        throw new Error("Alias is too long");
    }

    const repo = new GuildAnnouncerConfigRepository();
    const config = repo.getConfig(guildId);
    config.aliases[userId] = alias;
    repo.updateConfig(config);
}

export function deleteAlias(guildId: Guild["id"], userId: User["id"]): void {
    const repo = new GuildAnnouncerConfigRepository();
    const config = repo.getConfig(guildId);
    delete config.aliases[userId];
    repo.updateConfig(config);
}

export function getAlias(
    guildId: Guild["id"],
    userId: User["id"],
): string | undefined {
    const repo = new GuildAnnouncerConfigRepository();
    const config = repo.getConfig(guildId);
    return config.aliases[userId];
}
