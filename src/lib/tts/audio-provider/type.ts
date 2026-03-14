import type {Payload} from "@lib/tts/types";

/**
 * Generic Interface for Audio Provider with minimal functionality.
 * Configurations should be handled in the constructor of respective implementations
 */
export interface TTSProvider {
    createAudio(text: string): Promise<Payload[]>
}
