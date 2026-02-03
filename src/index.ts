import { Client, Events } from "discord.js";

import { clientOptions, devGuildId, token } from "config";
import {
  configureGVCAnnouncer,
  subscribeToGuild,
} from "@lib/tts/GuildVoiceChannelAnnouncer";
import messageCreateListener from "@events/message-create";
import voiceStateUpdateListener from "@events/voice-state-update";
import interactionCreateListener from "@events/interaction-create";
import errorListener from "@events/error";
import {
  deleteValue,
  getValue,
  storeValue,
} from "@lib/persist/key-value-store";
import { configureAlias } from "@lib/tts/member-alias";

function main() {
  // Initialize TTS announcer
  subscribeToGuild(devGuildId);
  // Connect with database
  configureGVCAnnouncer({
    persist: {
      text: {
        get: (subkey) => getValue(`tts/${subkey}`),
        set: (subkey, value) => storeValue(`tts/${subkey}`, value),
        delete: (subkey) => deleteValue(`tts/${subkey}`),
      },
      voice: {
        get: (subkey) => getValue(`tts/${subkey}`),
        set: (subkey, value) => storeValue(`tts/${subkey}`, value),
        delete: (subkey) => deleteValue(`tts/${subkey}`),
      },
    },
  });

  configureAlias({
    persist: {
      get: (subkey) => getValue(`alias/${subkey}`),
      set: (subkey, value) => storeValue(`alias/${subkey}`, value),
      delete: (subkey) => deleteValue(`alias/${subkey}`),
    },
  });

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
