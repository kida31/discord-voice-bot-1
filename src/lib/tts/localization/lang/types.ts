/** Information about a language, including its name, English name, optional emoji, and optional description. */
export type LanguageInfo = {
    name: string;
    en_name: string;
    emoji?: string;
    description?: string;
}

/** Common languages with BCP47 subtags, e.g. "en" for English, "de" for German, "ja" for Japanese, etc. */
export type StandardLanguage = LanguageInfo & { subtag: string; }