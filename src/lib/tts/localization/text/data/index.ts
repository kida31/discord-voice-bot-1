
import standardTemplates from "@lib/tts/localization/text/data/standard";
import variantsTemplates from "@lib/tts/localization/text/data/variants";
import type { LanguageTemplateMapping } from "../template";

export const templates = {
    ...standardTemplates,
    ...variantsTemplates,
} as const satisfies LanguageTemplateMapping;

// ---- Type Exports ----

export type SupportedLanguageKey = keyof typeof templates;

// ---- Data Exports ----

export const SUPPORTED_TEXT_LANGUAGE_KEYS = Object.keys(templates) as SupportedLanguageKey[];
