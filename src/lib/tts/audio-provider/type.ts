import type {Payload} from "@lib/tts/types";

/**
 * Generic Interface for Audio Provider with minimal functionality.
 * Configurations should be handled in the constructor of respective implementations
 */
export type TTSRequestContext = {
    guildId: string;
    userId: string;
    username: string;
    displayName: string;
};

export interface TTSProvider {
    createAudio(
        text: string,
        extras?: any,
        context?: TTSRequestContext,
    ): Promise<Payload[]>;
}
