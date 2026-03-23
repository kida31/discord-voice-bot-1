import { fillTemplate, getTemplate, type TextEventTypeThingie } from "./template";
import { type SupportedLanguageKey, templates } from "./data";

// ---- Type Exports ----

export { type SupportedLanguageKey, SUPPORTED_TEXT_LANGUAGE_KEYS } from "./data";

// ---- Helper functions ----

export function translate(lang: SupportedLanguageKey, type: TextEventTypeThingie, ...params: string[]) {
    const template = getTemplate(templates, lang, type);
    return fillTemplate(template, ...params);
}

export function tryTranslate(
    lang: SupportedLanguageKey,
    type: TextEventTypeThingie,
    ...params: string[]
): string {
    try {
        return translate(lang, type, ...params);
    }
    catch (error) {
        console.error(`Error translating text for language "${lang}" and type "${type}":`, error);
        return `TRANSLATION_ERROR(${lang}, ${type})`; // Return a placeholder string indicating a translation error
    }
}

export function textLangByKey(key: SupportedLanguageKey) {
    return templates[key];
}
