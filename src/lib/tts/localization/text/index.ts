import type {LanguageKey} from "@lib/tts/localization/lang";
import {fillTemplate, getTemplate, type LanguageTemplateMapping, type TextEventTypeThingie} from "./template";
import standardTemplates from "@lib/tts/localization/text/data/standard";
import variantsTemplates from "@lib/tts/localization/text/data/variants";

// ---- Data Exports ----

const textTemplates = {
    ...standardTemplates,
    ...variantsTemplates,
} as const satisfies LanguageTemplateMapping;

export const SUPPORTED_TEXT_LANGUAGE_KEYS = Object.keys(textTemplates) as (keyof typeof textTemplates)[];

// ---- Type Exports ----

export type SupportedLanguageKey = typeof SUPPORTED_TEXT_LANGUAGE_KEYS[number];

// ---- Helper functions ----

export function translate(lang: LanguageKey, type: TextEventTypeThingie, ...params: string[]): string {
    const template = getTemplate(textTemplates, lang, type);
    return fillTemplate(template, ...params);
}

export function textLangByKey(key: SupportedLanguageKey) {
    return textTemplates[key];
}