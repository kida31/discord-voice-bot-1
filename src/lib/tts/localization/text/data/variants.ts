/** This file contains "other" text data that don't fit in the standard ones,
 * e.g. more casual or meme-like data. */

import type { TemplateMapping } from "@lib/tts/localization/text/template";
import standardTemplates from "./standard";

const DE_STANDARD = standardTemplates.de;

/**
 * Text templates for non standard languages or variants of the standard ones.
 *
 * You can create your own language variants here, e.g. a more casual german variant,
 * or a "Gen Alpha" variant with more modern slang.
 * */
export default {
    /** Example text variant */
    alpha: {
        name: "Gen Alpha",
        join: "{0} is locked in for real",
    },

    /** Oliver is the best, so he deserves his own text data. */
    oliver: {
        name: "Oliver",
        join: "Yooo {0} lets gooo!",
        leave: "{0} der Verräter ist gegangen.",
    },

    /** A more casual german variant */
    de2: {
        ...DE_STANDARD, // de as default, de2 as "more casual" variant
        name: "Deutsch 2",
        join: "{0} ist jetzt am Start.",
        leave: "{0} hat den Squad verlassen.",
    },

    // Insert more here ...
} as const satisfies { [key: string]: TemplateMapping };
