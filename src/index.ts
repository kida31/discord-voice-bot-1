import {Client, Events} from "discord.js";

import {clientOptions, devGuildId, token} from "config";
import {subscribeToGuild,} from "@lib/tts/GuildVoiceChannelAnnouncer";
import messageCreateListener from "@events/message-create";
import voiceStateUpdateListener from "@events/voice-state-update";
import interactionCreateListener from "@events/interaction-create";
import errorListener from "@events/error";


function main() {
    // Initialize TTS announcer
    subscribeToGuild(devGuildId);
    // Connect with database

    // Create a new client instance
    const client = new Client(clientOptions);

    // When the client is ready, run this code (only once)
    client.once("clientReady", async () => {
        console.log(`\nReady! Logged in as ${client.user?.tag}\n`);
    });

    // Login to Discord with your client's token
    client.login(token);

    client
        .on(Events.Error, errorListener)
        .on(Events.InteractionCreate, interactionCreateListener)
        .on(Events.VoiceStateUpdate, voiceStateUpdateListener)
        .on(Events.MessageCreate, messageCreateListener);
}

main();
