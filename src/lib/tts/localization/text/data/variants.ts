import {de} from "@lib/tts/localization/text/data/standard";
import type {TemplateMapping} from "@lib/tts/localization/text/template";

/** This file contains "other" text data that don't fit in the standard ones, e.g. more casual or meme-like data. */

/** EXAMPLE.
 * You can create your own language variants here, e.g. a more casual german variant,
 * or a "Gen Alpha" variant with more modern slang.
 * Just make sure to satisfy the TemplateMapping type and export it, so it can be used in the language selection. */
export const alpha = {
    name: "Gen Alpha",
    join: "{0} is locked in for real",
} satisfies TemplateMapping;

/** Oliver is the best, so he deserves his own text data. */
export const oliver = {
    name: "Oliver",
    join: "Yooo {0} lets gooo!",
    leave: "{0} der Verräter ist gegangen."
} satisfies TemplateMapping;

/** A more casual german variant */
export const de2 = {
    ...de, // de as default, de2 as "more casual" variant
    name: "Deutsch 2",
    join: "{0} ist jetzt am Start.",
    leave: "{0} hat den Squad verlassen.",
} satisfies TemplateMapping;

export default {
    alpha,
    oliver,
    de2,
}
