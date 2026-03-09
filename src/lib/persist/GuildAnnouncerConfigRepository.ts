import type {LanguageKey} from "@lib/tts/localization/lang";
import type {SupportedLanguageKey as TextLangKey} from "@lib/tts/localization/text";
import type {VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";
import type {Guild, User} from "discord.js";
import {deleteValue, getValue, storeValue} from "@lib/persist/key-value-store";

/** This class represents the configuration for the guild announcer. */

/* Make sure all values extend string */
export interface GuildAnnouncerConfig {
    guildId: string;
    voiceLanguage: LanguageKey;
    textLanguage: TextLangKey;
    elevenLabsVoiceId: VoiceId | null;
    aliases: { [key: User["id"]]: string };
}

const DEFAULT_CONFIG: Omit<GuildAnnouncerConfig, "guildId"> = {
    voiceLanguage: "en",
    textLanguage: "en",
    elevenLabsVoiceId: null,
    aliases: {},
};

const baseItemKey = "tts/guild-announcer-config";
const itemKey = (guildId: string) => `${baseItemKey}/${guildId}`;

export class GuildAnnouncerConfigRepository {
    getConfig(guildId: Guild["id"]): GuildAnnouncerConfig {
        const key = itemKey(guildId);
        const json = getValue(key);
        return json ? JSON.parse(json) as GuildAnnouncerConfig : {guildId, ...DEFAULT_CONFIG};
    }

    setConfig(config: GuildAnnouncerConfig) {
        const key = itemKey(config.guildId);
        const json = JSON.stringify(config);
        storeValue(key, json);
    }

    updateConfig(updates: Partial<GuildAnnouncerConfig> & Pick<GuildAnnouncerConfig, "guildId">) {
        const guildId = updates.guildId;
        const key = itemKey(guildId);
        const existingJson = getValue(key);
        const existingConfig = existingJson ? JSON.parse(existingJson) as GuildAnnouncerConfig : undefined;

        if (existingConfig) {
            const updatedConfig = {...existingConfig, ...updates};
            const updatedJson = JSON.stringify(updatedConfig);
            storeValue(key, updatedJson);
        } else {
            if (!updates.voiceLanguage || !updates.textLanguage || updates.aliases == null) {
                throw new Error("Missing required fields for new config");
            } else {
                this.setConfig({
                    ...DEFAULT_CONFIG,
                    ...updates,
                });
            }
        }
    }

    deleteConfig(guildId: Guild["id"]) {
        const key = itemKey(guildId);
        deleteValue(key);
    }
}
