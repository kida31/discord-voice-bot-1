import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import type {ChatInputCommand} from "./type";
import {getAnnouncer, setGuildTextLanguage, updateTTSPlayer,} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {
    SUPPORTED_TEXT_LANGUAGE_KEYS,
    type SupportedLanguageKey as TextLanguageKey,
    textLangByKey
} from "@lib/tts/localization/text";

const languageOptions: { name: string; value: TextLanguageKey }[] = SUPPORTED_TEXT_LANGUAGE_KEYS
    .filter(key => textLangByKey(key))
    .map(key => {
        const tl = textLangByKey(key);
        return {
            name: tl.name,
            value: key,
        }
    })

const data = new SlashCommandBuilder()
    .setName("language")
    .setNameLocalization("de", "sprache")
    .setDescription("Set text language for TTS announcer")
    .setDescriptionLocalization("de", "Textsprache für TTS-Ansager festlegen.")
    .addStringOption((option) =>
        option
            .setName("lang")
            .setNameLocalization("de", "sprache")
            .setDescription("Language")
            .setDescriptionLocalization("de", "Sprache")
            .setRequired(true)
            .addChoices(...languageOptions),
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId || !interaction.guild) return;

    const textLangKey = interaction.options.getString("lang", true) as TextLanguageKey;

    setGuildTextLanguage(interaction.guildId, textLangKey);

    if (getAnnouncer(interaction.guildId)) {
        await updateTTSPlayer(interaction.guild)
    }

    await interaction.reply({
        content: "Text language set to: `" + textLangKey + "`",
    });
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;
