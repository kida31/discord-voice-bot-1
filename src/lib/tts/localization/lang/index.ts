
import {standard} from "@lib/tts/localization/lang/data/standard";
import type {LanguageInfo} from "@lib/tts/localization/lang/types";

/** BCP47 subtag according to convention, e.g. "en" for English, "de" for German, "ja" for Japanese, etc. */
export type Subtag = typeof standard[keyof typeof standard]["subtag"];

/** Tag-Subtag-Region codes according to convention BCP47 */
export type BCP47 = Exclude<`${Subtag}-${string}`, `${Subtag}-`> | Subtag;

/** Identification key for this project. Not necessarily a standard code, but often corresponds to the BCP47 subtag. */
export type LanguageKey = keyof typeof languages;

/** Standardized code for the language, often corresponding to the BCP47 subtag. */
export type LanguageCode = Subtag;

/** Human-readable name of the language in its own language. */
export type LanguageName = typeof languages[keyof typeof languages]["name"];

/** English name of the language. */
export type LanguageEnName = typeof languages[keyof typeof languages]["en_name"];

// ------------------ Language data ------------------

/** Language data for all supported languages, keyed by arbitrary LanguageKey. */
export const languages = standard;

// ------------ Lookup functions to retrieve language info by different identifiers -----

/** Get language info by LanguageKey. */
export function langByKey(key: LanguageKey) {
    return languages[key];
}

/** Get language info by BCP47 code. */
export function langByCode(code: Subtag) {
    return langBySubtag(code);
}

/** Get language info by BCP47 subtag. */
export function langBySubtag(subtag: Subtag): LanguageInfo & { subtag: Subtag } {
    return Object.values(languages)
        .filter(l => 'subtag' in l)
        .find(lang => lang.subtag === subtag)!;
}

/** Get language info by human-readable name. */
export function langByName(name: string): LanguageInfo | undefined {
    return Object.values(languages)
        .find(lang => lang.name === name);
}

/** Get language info by English name. */
export function langByEnName(en_name: string): LanguageInfo | undefined {
    return Object.values(languages)
        .find(lang => lang.en_name === en_name);
}