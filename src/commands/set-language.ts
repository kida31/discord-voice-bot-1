import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import type {ChatInputCommand} from "./type";
import {setGuildTextLanguage,} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {type SupportedLanguageKey as TextLanguageKey, supportedLanguages} from "@lib/tts/localization/text";
import {fromKey} from "@lib/tts/localization/lang";

const languageOptions: { name: string; value: TextLanguageKey }[] = supportedLanguages
    .filter(key => fromKey(key))
    .map(key => {
        const l = fromKey(key);
        return {
            name: l.name == l.en_name ? l.name : `${l.name} (${l.en_name})`,
            value: key,
        }
    })

const data = new SlashCommandBuilder()
    .setName("language")
    .setDescription("Set language for TTS announcer")

    .addStringOption((option) =>
        option
            .setName("lang")
            .setDescription("Language")
            .setRequired(true)
            .addChoices(...languageOptions),
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return;

    const textLangKey = interaction.options.getString("lang", true) as TextLanguageKey;

    setGuildTextLanguage(interaction.guildId, textLangKey);

    await interaction.reply({
        content: "Text language set to: `" + textLangKey + "`",
    });
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;
