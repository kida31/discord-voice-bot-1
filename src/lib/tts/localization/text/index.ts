import type {LanguageKey} from "@lib/tts/localization/lang";
import type {TemplateMapping, TextEventTypeThingie} from "@lib/tts/localization/text/type";

import {alpha, oliver} from "@lib/tts/localization/text/other";
import {de, en, ko, vi} from "@lib/tts/localization/text/common";

const textTemplates = {
    en, de, vi, ko, alpha, oliver,
} satisfies { [key in LanguageKey]?: Partial<TemplateMapping> };

function fillTemplate(template: string, ...params: string[]): string {
    return template.replace(/{(\d+)}/g, (_, index: number) => {
        if (typeof params[index] === 'undefined') {
            throw new Error(`Missing parameter for placeholder {${index}} in template: "${template}"`);
        }
        return params[index];
    });
}

export function translate(lang: LanguageKey, type: TextEventTypeThingie, ...params: string[]): string {
    if (lang as keyof typeof textTemplates) {
        const langTemplates = textTemplates[lang as keyof typeof textTemplates];
        if (langTemplates && type in langTemplates) {
            const template = langTemplates[type as keyof typeof langTemplates];
            if (template) {
                return fillTemplate(template, ...params);
            }
        }
    }
    return fillTemplate(textTemplates.en[type], ...params);
}

export const supportedLanguages = Object.keys(textTemplates) as LanguageKey[];
export type SupportedLanguageKey = typeof supportedLanguages[number];
