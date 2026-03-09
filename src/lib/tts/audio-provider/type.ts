import type {Payload} from "@lib/tts/tts-stuff";

/**
 * Generic Interface for Audio Provider with minimal functionality.
 * Configurations should be handled in the constructor of respective implementations
 */
export interface AudioProvider {
    // TODO: Rename to "create" later.
    toSpeech(text: string): Promise<Payload[]>
}

// Alias
export type TTSProvider = AudioProvider;
