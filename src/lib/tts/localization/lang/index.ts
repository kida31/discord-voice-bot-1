/** List of languages with code (subtag) and name */
import {common, type Subtag} from "@lib/tts/localization/lang/common";
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
} satisfies { [key: string]: Info };

export type {Subtag, BCP47} from "@lib/tts/localization/lang/common";

export type LanguageKey = keyof typeof languages;
export type LanguageName = typeof languages[keyof typeof languages]["name"];
export type LanguageEnName = typeof languages[keyof typeof languages]["en_name"];

export function byKey(key: LanguageKey): Info {
    return languages[key];
}

export function bySubtag(subtag: Subtag): Info & { subtag: Subtag } {
    return Object.values(languages)
        .filter(l => 'subtag' in l)
        .find(lang => lang.subtag === subtag)!;
}

export function byName(name: string): Info | undefined {
    return Object.values(languages)
        .find(lang => lang.name === name);
}

export function byEnName(en_name: string): Info | undefined {
    return Object.values(languages)
        .find(lang => lang.en_name === en_name);
}