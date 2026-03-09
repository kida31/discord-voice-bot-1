import type {LanguageKey} from "@lib/tts/localization/lang";

export type TextEventTypeThingie = "join" | "leave" | "muted" | "unmuted";
export type TemplateMapping = { [key in TextEventTypeThingie]: string }
export type LanguageTemplateMapping = { [key in LanguageKey]?: Partial<TemplateMapping> }

// Template of the form "Hello {0}, welcome to {1}!" where {0} and {1} are placeholders for parameters.
export function fillTemplate(template: string, ...params: string[]): string {
    return template.replace(/{(\d+)}/g, (_, index: number) => {
        if (typeof params[index] === 'undefined') {
            throw new Error(`Missing parameter for placeholder {${index}} in template: "${template}"`);
        }
        return params[index];
    });
}

export function getTemplate(templates: LanguageTemplateMapping, lang: LanguageKey, type: TextEventTypeThingie): string {
    if (lang as keyof typeof templates) {
        const langTemplates = templates[lang as keyof typeof templates];
        if (langTemplates && type in langTemplates) {
            const template = langTemplates[type as keyof typeof langTemplates];
            if (template) {
                return template;
            }
        }
    }

    return templates.en![type]!; // Fallback to English if the requested language or template type is not available
}
