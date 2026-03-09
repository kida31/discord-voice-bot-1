import type {BCP47} from "@lib/tts/localization/lang";

export type VoiceId = string & { __brand: "VoiceId" };

export interface Voice {
    id: VoiceId;
    name: string;
    description?: string;
    compatibleLanguages: BCP47[];
}