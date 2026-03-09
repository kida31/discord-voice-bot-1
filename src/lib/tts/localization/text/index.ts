import type {LanguageKey} from "@lib/tts/localization/lang";
import {
    fillTemplate,
    getTemplate,
    type LanguageTemplateMapping,
    type TextEventTypeThingie
} from "@lib/tts/localization/text/template";
import commonTextLanguages from "@lib/tts/localization/text/common";
import otherTextLanguages from "@lib/tts/localization/text/other";

const textTemplates = {
    ...commonTextLanguages,
    ...otherTextLanguages,
} as const satisfies LanguageTemplateMapping;

export function translate(lang: LanguageKey, type: TextEventTypeThingie, ...params: string[]): string {
    const template = getTemplate(textTemplates, lang, type);
    return fillTemplate(template, ...params);
}

export const supportedLanguages = Object.keys(textTemplates) as LanguageKey[];
export type SupportedLanguageKey = typeof supportedLanguages[number];