import {type LanguageKey, languages} from "@lib/tts/localization/lang";

export const supportedLanguages = Object.keys(languages) as LanguageKey[];
export type SupportedLanguageKey = typeof supportedLanguages[number];
