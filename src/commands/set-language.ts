import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import {getNickname, type LanguageCode} from "@lib/tts/tts-stuff";
import type {ChatInputCommand} from "./type";
import {setGuildTextLanguage, setGuildVoiceLanguage,} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {supportedLanguages, type SupportedLanguageKey as TextLanguageKey} from "@lib/tts/localization/text";
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
    .setDescription("Set language for TTS player")
    .addSubcommand((sc) =>
        sc
            .setName("voice")
            .setDescription("Set language for tts voie")
            .addStringOption((option) =>
                option
                    .setName("lang")
                    .setDescription("Language")
                    .setRequired(true)
                    .addChoices(...languageOptions),
            ),
    )
    .addSubcommand((sc) =>
        sc
            .setName("text")
            .setDescription("Set language for tts text")
            .addStringOption((option) =>
                option
                    .setName("lang")
                    .setDescription("Language")
                    .setRequired(true)
                    .addChoices(...languageOptions),
            ),
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return;

    const textLangKey = interaction.options.getString("lang", true) as TextLanguageKey;
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand == "voice") {
        setGuildVoiceLanguage(interaction.guildId, textLangKey as LanguageCode);
        {
            const name = getNickname(textLangKey as LanguageCode);
            console.log("Trying to set nickname to...", name);
            await interaction.guild?.members.me?.setNickname(name);
        }

        await interaction.reply({
            content: "Voice language set to: `" + textLangKey + "`",
        });
    } else if (subcommand == "text") {
        setGuildTextLanguage(interaction.guildId, textLangKey);

        await interaction.reply({
            content: "Text language set to: `" + textLangKey + "`",
        });
    } else {
        console.error("Unknown command in 'language'>", subcommand);
    }
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;
