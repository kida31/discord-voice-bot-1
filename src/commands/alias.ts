import {
    CommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import type {ChatInputCommand} from "./type";
import {
    ALIAS_MAX_LENGTH,
    getAlias,
    setAlias,
} from "@lib/tts/member-alias";

const NAME_OPTION = "name";
const USER_OPTION = "user";

const data = new SlashCommandBuilder()
    .setName("alias")
    .setDescription("Set your spoken alias for TTS announcements")
    .setDescriptionLocalization(
        "de",
        "Lege deinen gesprochenen Alias für TTS-Ansagen fest",
    )
    .addStringOption((option) =>
        option
            .setName(NAME_OPTION)
            .setDescription("Your 'pronounced' name")
            .setDescriptionLocalization(
                "de",
                "Der Name, den der TTS-Bot aussprechen soll",
            )
            .setMaxLength(ALIAS_MAX_LENGTH),
    )
    .addUserOption((option) =>
        option
            .setName(USER_OPTION)
            .setDescription(
                "User whose alias should be managed (admins only)",
            )
            .setDescriptionLocalization(
                "de",
                "Benutzer, dessen Alias verwaltet werden soll (nur Admins)",
            ),
    );

async function execute(
    interaction: CommandInteraction,
): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild() || !interaction.guild) return;
    if (!interaction.member) return;

    const selectedUser =
        interaction.options.getUser(USER_OPTION);

    const targetUser =
        selectedUser ?? interaction.user;

    const isManagingAnotherUser =
        targetUser.id !== interaction.user.id;

    /*
     * Only Discord server administrators may read or modify
     * another user's TTS alias.
     */
    if (isManagingAnotherUser) {
        const isAdministrator =
            interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator,
            ) ?? false;

        if (!isAdministrator) {
            await interaction.reply({
                content:
                    "Du benötigst Administrator-Rechte, "
                    + "um den TTS-Alias einer anderen Person "
                    + "zu verwalten.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }
    }

    const alias = interaction.options
        .getString(NAME_OPTION)
        ?.trim()
        .substring(0, ALIAS_MAX_LENGTH);

    if (alias && alias.length > 0) {
        setAlias(
            interaction.guildId,
            targetUser.id,
            alias,
        );

        await interaction.reply({
            content: isManagingAnotherUser
                ? `Der TTS-Alias von ${targetUser} wurde auf \`${alias}\` gesetzt.`
                : `Dein TTS-Alias wurde auf \`${alias}\` gesetzt.`,
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    const existingAlias = getAlias(
        interaction.guildId,
        targetUser.id,
    );

    if (existingAlias) {
        await interaction.reply({
            content: isManagingAnotherUser
                ? `Der aktuelle TTS-Alias von ${targetUser} ist \`${existingAlias}\`.`
                : `Dein aktueller TTS-Alias ist \`${existingAlias}\`.`,
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    await interaction.reply({
        content: isManagingAnotherUser
            ? `${targetUser} hat aktuell keinen TTS-Alias gesetzt.`
            : `Du hast aktuell keinen TTS-Alias gesetzt. Verwende \`/${data.name} name:<Alias>\`, um einen zu setzen.`,
        flags: MessageFlags.Ephemeral,
    });
}

export default {
    data,
    execute,
} satisfies ChatInputCommand;