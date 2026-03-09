import type {Payload} from "@lib/tts/tts-stuff";

/**
 * Generic Interface for Audio Provider with minimal functionality.
 * Configurations should be handled in the constructor of respective implementations
 */
export interface TTSProvider {
    // TODO: Rename to "create" later.
    createAudio(text: string): Promise<Payload[]>
}
