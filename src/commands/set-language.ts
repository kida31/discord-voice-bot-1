import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import type {ChatInputCommand} from "./type";
import {getAnnouncer, setGuildTextLanguage, updateTTSPlayer,} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {SUPPORTED_TEXT_LANGUAGE_KEYS, type SupportedLanguageKey as TextLanguageKey} from "@lib/tts/localization/text";
import {langByKey} from "@lib/tts/localization/lang";

const languageOptions: { name: string; value: TextLanguageKey }[] = SUPPORTED_TEXT_LANGUAGE_KEYS
    .filter(key => langByKey(key))
    .map(key => {
        const l = langByKey(key);
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
