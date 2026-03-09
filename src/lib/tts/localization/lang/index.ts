/** List of languages with code (subtag) and name */
import {common, type Subtag} from "@lib/tts/localization/lang/common";

export type Info = {
    name: string;
    en_name: string;
    emoji?: string;
    description?: string;
}

export const languages = common;

export type {Subtag, BCP47} from "@lib/tts/localization/lang/common";

// Identification key for this project. Not necessarily a standard code, but often corresponds to the BCP47 subtag.
export type LanguageKey = keyof typeof languages;
export type LanguageCode = Subtag;
export type LanguageName = typeof languages[keyof typeof languages]["name"];
export type LanguageEnName = typeof languages[keyof typeof languages]["en_name"];

export function langByKey(key: LanguageKey) {
    return languages[key];
}

export function langByCode(code: Subtag) {
    return langBySubtag(code);
}

export function langBySubtag(subtag: Subtag): Info & { subtag: Subtag } {
    return Object.values(languages)
        .filter(l => 'subtag' in l)
        .find(lang => lang.subtag === subtag)!;
}

export function langByName(name: string): Info | undefined {
    return Object.values(languages)
        .find(lang => lang.name === name);
}

export function langByEnName(en_name: string): Info | undefined {
    return Object.values(languages)
        .find(lang => lang.en_name === en_name);
}