import {CommandInteraction, MessageFlags, SlashCommandBuilder,} from "discord.js";
import type {ChatInputCommand} from "./type";
import {ALIAS_MAX_LENGTH, getAlias, setAlias} from "@lib/tts/member-alias";

const NAME_OPTION = "name";

const data = new SlashCommandBuilder()
    .setName("alias")
    .setDescription("Set your spoken alias for TTS announcements")
    .setDescriptionLocalization("de", "Lege deinen gesprochenen Alias für TTS-Ansagen fest")
    .addStringOption((option) =>
        option
            .setName(NAME_OPTION)
            .setDescription("Your 'pronounced' name")
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild() || !interaction.guild) return;
    if (!interaction.member) return;

    const alias = interaction.options
        .getString(NAME_OPTION)
        ?.substring(0, ALIAS_MAX_LENGTH);

    if (alias && alias.length > 0) {
        // Set the alias for the user in the guild
        setAlias(interaction.guildId, interaction.member.user.id, alias);
        await interaction.reply({
            content: `Your TTS alias has been set to \`${alias}\``,
            flags: MessageFlags.Ephemeral,
        });
    } else {
        // else show the current alias, if any.
        const existingAlias = getAlias(interaction.guildId, interaction.member.user.id);
        if (existingAlias) {
            await interaction.reply({
                content: `Your current TTS alias is \`${existingAlias}\`. To change it, use \`/${data.name} <alias>\``,
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: `You don't have a TTS alias set. To set one, use \`/${data.name} <alias>\``,
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;
