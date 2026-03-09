/** List of languages with code (subtag) and name */
import {common} from "@lib/tts/localization/lang/common";
import {others} from "@lib/tts/localization/lang/other";

export type Info = {
    name: string;
    en_name: string;
    subtag?: string;
    emoji?: string;
    description?: string;
}
export const languages = {
    ...common,
    ...others,
}

export type {Subtag, BCP47} from "@lib/tts/localization/lang/common";

export type LanguageKey = keyof typeof languages;
export type LanguageName = typeof languages[keyof typeof languages]["name"];
export type LanguageEnName = typeof languages[keyof typeof languages]["en_name"];
