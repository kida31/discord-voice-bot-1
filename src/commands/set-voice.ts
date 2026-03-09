import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import type {ChatInputCommand} from "./type";
import {setGuildVoiceLanguage,} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {byId as voiceById, type VoiceId, VOICES} from "@lib/tts/audio-provider/eleven-labs/voices";
import type {SupportedLanguageKey} from "@lib/tts/localization/voice";
import {bySubtag, type Subtag} from "@lib/tts/localization/lang";

const defaultLangTagOptions = ['en', 'de', 'ja', 'vi', 'ko'] as const satisfies SupportedLanguageKey[];

const langTagOptions = defaultLangTagOptions.map(tag => {
    const l = bySubtag(tag);
    return {
        name: l.name == l.en_name ? l.name : `${l.name} (${l.en_name})`,
        value: tag,
    }
});

const voiceOptions = VOICES.map(v => ({name: v.name, value: v.id}));

const data = new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Set voice for TTS player.")
    .addSubcommand(sc =>
        sc
            .setName("tag")
            .setDescription("Set voice by common language tag.")
            .addStringOption(opt =>
                opt
                    .setName("langtag")
                    .setDescription("Common language tag")
                    .setRequired(true)
                    .addChoices(...langTagOptions))
    )
    .addSubcommand(sc =>
        sc
            .setName('elevenlabs')
            .setDescription("Set voice by ElevenLabs voice key.")
            .addStringOption(opt =>
                opt
                    .setName("voiceid")
                    .setDescription("ElevenLabs voice key")
                    .setRequired(true)
                    .addChoices(...voiceOptions))
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return;

    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === "tag") {
        const langtag = interaction.options.getString("langtag", true) as Subtag;
        const lang = bySubtag(langtag);

        setGuildVoiceLanguage(interaction.guildId, lang.subtag);

        // {
        //     const name = getNickname(langTag);
        //     console.log("Trying to set nickname to...", name);
        //     await interaction.guild?.members.me?.setNickname(name);
        // }

        await interaction.reply({
            content: `Voice set to: **${lang.name} (${lang.en_name})**`,
        });
    } else if (subcommand === "elevenlabs") {
        const voiceId = interaction.options.getString("voiceid", true) as VoiceId;
        console.log("Selected voice ID:", voiceId);
        const voice = voiceById(voiceId);
        // setGuildVoiceLanguage(interaction.guildId, voiceId);

        // {
        //     const name = getNickname(voiceId );
        //     console.log("Trying to set nickname to...", name);
        //     await interaction.guild?.members.me?.setNickname(name);
        // }

        await interaction.reply({
            content: `Voice set to: **${voice.name}**`,
        });
    } else {
        console.error("Unknown command in 'language'>", subcommand);

        return;
    }
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;
