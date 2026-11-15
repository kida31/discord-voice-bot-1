export type TextEventTypeThingie = "join" | "leave" | "muted" | "unmuted";

export type TemplateMapping = {
    [key in TextEventTypeThingie]?: string
} & {
    name: string
};

export type LanguageTemplateMapping = Record<string, TemplateMapping>;

// Template of the form "Hello {0}, welcome to {1}!" where {0} and {1} are placeholders for parameters.
export function fillTemplate(template: string, ...params: string[]): string {
    return template.replace(/{(\d+)}/g, (_, index: number) => {
        if (typeof params[index] === "undefined") {
            throw new Error(`Missing parameter for placeholder {${index}} in template: "${template}"`);
        }

        return params[index];
    });
}

export function getTemplate(
    templates: LanguageTemplateMapping,
    lang: string,
    type: TextEventTypeThingie
): string {
    const langTemplates = templates[lang];

    if (langTemplates) {
        const template = langTemplates[type];

        if (template) {
            return template;
        }
    }

    // Fallback to English if the requested language or template type is not available
    return templates["en"]![type]!;
}