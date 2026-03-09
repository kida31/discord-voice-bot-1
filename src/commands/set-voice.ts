import {CommandInteraction, SlashCommandBuilder} from "discord.js";
import {getNickname, type LanguageCode} from "@lib/tts/tts-stuff";
import type {ChatInputCommand} from "./type";
import {setGuildVoiceLanguage,} from "@lib/tts/GuildVoiceChannelAnnouncer";
import {fromKey, type LanguageKey} from "@lib/tts/localization/lang";
import {supportedLanguages} from "@lib/tts/localization/voice";

const languageOptions: { name: string; value: LanguageKey }[] = supportedLanguages
    .filter(key => fromKey(key))
    .map(key => {
        const l = fromKey(key);
        return {
            name: l.name == l.en_name ? l.name : `${l.name} (${l.en_name})`,
            value: key,
        }
    });

const voiceOptions = [
    ...languageOptions,
].slice(0, 25)

const data = new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Set voice for TTS player.")
    .addStringOption((option) =>
        option
            .setName("key")
            .setDescription("Language tag or voice key")
            .setRequired(true)
            .addChoices(...voiceOptions),
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return;

    const voiceKey = interaction.options.getString("key", true) as LanguageKey;

    setGuildVoiceLanguage(interaction.guildId, voiceKey);

    {
        const name = getNickname(voiceKey as LanguageCode);
        console.log("Trying to set nickname to...", name);
        await interaction.guild?.members.me?.setNickname(name);
    }

    await interaction.reply({
        content: "Voice language set to: `" + voiceKey + "`",
    });

}

export default {
    data,
    execute,
} satisfies ChatInputCommand;
