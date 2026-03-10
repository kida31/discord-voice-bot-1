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

    // Create a new client instance
    const client = new Client(clientOptions);

    client
        // When the client is ready, run this code (only once)
        .once("clientReady", async () => {
            console.log(`\nReady! Logged in as ${client.user?.tag}\n`);
        })
        // Error Handling
        .on(Events.Error, errorListener)
        // Mostly slash command handling
        .on(Events.InteractionCreate, interactionCreateListener)
        // Handle user join/leave voice channel
        .on(Events.VoiceStateUpdate, voiceStateUpdateListener)
        // Read messages in channels
        .on(Events.MessageCreate, messageCreateListener);

    client
        .login(token) // Login to Discord with your client's token
        .then(s => console.log("[login] " + s));
}

main();
