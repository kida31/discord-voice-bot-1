import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import type {ChatInputCommand} from "./type";
import {
    getAnnouncer,
    setGuildVoiceLanguage,
    setGuildVoiceModel,
    updateTTSPlayer,
} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {byId as voiceById, VOICES} from "@lib/tts/audio-provider/eleven-labs/voices";
import type {SupportedLanguageKey} from "@lib/tts/localization/voice";
import {langBySubtag, type Subtag} from "@lib/tts/localization/lang";
import type {VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";
import {getLanguageNickname, getVoiceNickname} from "@lib/tts/bot-nickname";

const LANG_TAG_OPTION_NAME = "tag";
const VOICE_ID_OPTION_NAME = "voicemodel";

const SUBCOMMAND_LANGCODE = "languagecode";
const SUBCOMMAND_ELEVENLABS = "elevenlabs";


const defaultLangTagOptions = ['en', 'de', 'ja', 'vi', 'ko'] as const satisfies SupportedLanguageKey[];

const langTagOptions = defaultLangTagOptions.map(tag => {
    const l = langBySubtag(tag);
    return {
        name: l.name == l.en_name ? l.name : `${l.name} (${l.en_name})`,
        value: tag,
    }
});

const voiceOptions = Object.values(VOICES)
    .map(v => ({name: v.name, value: v.id}));



const data = new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Set voice for TTS player.")
    .addSubcommand(sc =>
        sc
            .setName(SUBCOMMAND_LANGCODE)
            .setDescription("Set voice by common language tag.")
            .addStringOption(opt =>
                opt
                    .setName(LANG_TAG_OPTION_NAME)
                    .setDescription("Common language tag")
                    .setRequired(true)
                    .addChoices(...langTagOptions))
    )
    .addSubcommand(sc =>
        sc
            .setName(SUBCOMMAND_ELEVENLABS)
            .setDescription("Set voice model for ElevenLabs. This overrides the language tag setting, if any.")
            .addStringOption(opt =>
                opt
                    .setName(VOICE_ID_OPTION_NAME)
                    .setDescription("ElevenLabs voice key")
                    .setRequired(true)
                    .addChoices(...voiceOptions))
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return;

    const subcommand = interaction.options.getSubcommand(true);

    if (![SUBCOMMAND_LANGCODE, SUBCOMMAND_ELEVENLABS].includes(subcommand) || !interaction.guild) {
        console.error("Unknown subcommand in 'voice'>", subcommand);
        return;
    }

    if (subcommand === SUBCOMMAND_LANGCODE) {
        const langtag = interaction.options.getString(LANG_TAG_OPTION_NAME, true) as Subtag;
        const language = langBySubtag(langtag);

        setGuildVoiceLanguage(interaction.guildId, language.subtag);

        {
            const name = getLanguageNickname(language.subtag);
            console.log("Trying to set nickname to...", name);
            await interaction.guild?.members.me?.setNickname(name);
        }

        await interaction.reply({
            content: `Voice set to: **${language.name} (${language.en_name})**`,
        });
    } else if (subcommand === SUBCOMMAND_ELEVENLABS) {
        const voiceId = interaction.options.getString(VOICE_ID_OPTION_NAME, true) as VoiceId;
        console.log("Selected voice ID:", voiceId);
        const voice = voiceById(voiceId);

        setGuildVoiceModel(interaction.guildId, voice.id);

        {
            const name = getVoiceNickname(voice);
            console.log("Trying to set nickname to...", name);
            await interaction.guild?.members.me?.setNickname(name);
        }

        await interaction.reply({
            content: `Voice set to: **${voice.name}**`,
        });
    }

    if (getAnnouncer(interaction.guildId)) {
        await updateTTSPlayer(interaction.guild)
    }
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;
