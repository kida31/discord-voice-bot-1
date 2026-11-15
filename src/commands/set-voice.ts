import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import type {ChatInputCommand} from "./type";
import {
    getAnnouncer,
    setGuildVoiceLanguage,
    setGuildVoiceModel,
    updateTTSPlayer,
} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {voiceById, VOICES} from "@lib/tts/audio-provider/eleven-labs/voices";
import type {SupportedLanguageKey} from "@lib/tts/localization/voice";
import {langBySubtag, type Subtag} from "@lib/tts/localization/lang";
import type {VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";
import {getLanguageNickname, getVoiceNickname} from "@lib/tts/bot-nickname";

const SUBCOMMAND_LANGCODE = "tag";
const LANG_TAG_OPTION_NAME = "langtag";

const SUBCOMMAND_ELEVENLABS = "elevenlabs";
const VOICE_ID_OPTION_NAME = "voicemodel";

const defaultLangTagOptions = [
    "en",
    "de",
    "ja",
    "vi",
    "ko",
] as const satisfies SupportedLanguageKey[];

const langTagOptions = defaultLangTagOptions.map((tag) => {
    const language = langBySubtag(tag);

    return {
        name:
            language.name === language.en_name
                ? language.name
                : `${language.name} (${language.en_name})`,
        value: tag,
    };
});

const voiceOptions = Object.values(VOICES).map((voice) => ({
    name: voice.name,
    value: voice.id,
}));

const data = new SlashCommandBuilder()
    .setName("voice")
    .setNameLocalization("de", "stimme")
    .setDescription("Set voice for TTS player.")
    .setDescriptionLocalization(
        "de",
        "Stimme für TTS-Ansager festlegen.",
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName(SUBCOMMAND_LANGCODE)
            .setNameLocalization("de", "kürzel")
            .setDescription(
                "Set voice by standard language tag.",
            )
            .setDescriptionLocalization(
                "de",
                "Stimme anhand eines Sprachkürzels festlegen.",
            )
            .addStringOption((option) =>
                option
                    .setName(LANG_TAG_OPTION_NAME)
                    .setDescription("Common language tag")
                    .setRequired(true)
                    .addChoices(...langTagOptions),
            ),
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName(SUBCOMMAND_ELEVENLABS)
            .setDescription(
                "Set voice model for ElevenLabs. This overrides the language tag setting, if any.",
            )
            .setDescriptionLocalization(
                "de",
                "Stimme anhand eines ElevenLabs-Stimmenmodells festlegen. Überschreibt die Sprachkürzel-Einstellung.",
            )
            .addStringOption((option) =>
                option
                    .setName(VOICE_ID_OPTION_NAME)
                    .setDescription("ElevenLabs voice key")
                    .setRequired(true)
                    .addChoices(...voiceOptions),
            ),
    );

async function execute(
    interaction: CommandInteraction,
): Promise<void> {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (!interaction.guildId || !interaction.guild) {
        return;
    }

    const subcommand =
        interaction.options.getSubcommand(true);

    if (
        ![
            SUBCOMMAND_LANGCODE,
            SUBCOMMAND_ELEVENLABS,
        ].includes(subcommand)
    ) {
        console.error(
            "Unknown subcommand in 'voice'>",
            subcommand,
        );
        return;
    }

    if (subcommand === SUBCOMMAND_LANGCODE) {
        const langtag =
            interaction.options.getString(
                LANG_TAG_OPTION_NAME,
                true,
            ) as Subtag;

        const language = langBySubtag(langtag);

        setGuildVoiceLanguage(
            interaction.guildId,
            language.subtag,
        );

        const nickname =
            getLanguageNickname(language.subtag);

        console.log(
            "Trying to set nickname to...",
            nickname,
        );

        await interaction.guild.members.me?.setNickname(
            nickname,
        );

        await interaction.reply({
            content:
                `Voice set to: **${language.name} `
                + `(${language.en_name})**`,
        });
    } else if (
        subcommand === SUBCOMMAND_ELEVENLABS
    ) {
        const voiceId =
            interaction.options.getString(
                VOICE_ID_OPTION_NAME,
                true,
            ) as VoiceId;

        console.log(
            "Selected voice ID:",
            voiceId,
        );

        const voice = voiceById(voiceId);

        /*
         * Do not let an unknown or outdated voice ID
         * crash the entire Discord bot.
         */
        if (!voice) {
            console.error(
                `Voice ID "${voiceId}" was not found in VOICES.`,
            );

            await interaction.reply({
                content:
                    "Die ausgewählte ElevenLabs-Stimme konnte "
                    + "nicht gefunden werden. Bitte wähle die "
                    + "Stimme erneut aus.",
                ephemeral: true,
            });

            return;
        }

        setGuildVoiceModel(
            interaction.guildId,
            voice.id,
        );

        const nickname =
            getVoiceNickname(voice);

        console.log(
            "Trying to set nickname to...",
            nickname,
        );

        await interaction.guild.members.me?.setNickname(
            nickname,
        );

        await interaction.reply({
            content: `Voice set to: **${voice.name}**`,
        });
    }

    /*
     * Recreate the currently active TTS player so that
     * a newly selected language/voice takes effect immediately.
     */
    if (getAnnouncer(interaction.guildId)) {
        await updateTTSPlayer(
            interaction.guild,
        );
    }
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;