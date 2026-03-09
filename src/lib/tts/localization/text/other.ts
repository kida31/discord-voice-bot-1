import {de} from "@lib/tts/localization/text/common";
import type {TemplateMapping} from "@lib/tts/localization/text/template";

export const alpha = {
    join: "{0} is locked in for real",
} satisfies Partial<TemplateMapping>;

export const oliver = {
    join: 'Yooo {0} lets gooo!',
    leave: '{0} der Verräter ist gegangen.`'
} satisfies Partial<TemplateMapping>;

export const de2 = {
    ...de, // de as default, de2 as "more casual" variant
    join: "{0} ist jetzt am Start.",
    leave: "{0} hat den Squad verlassen.",
} satisfies Partial<TemplateMapping>;

export default {
    alpha,
    oliver,
    de2,
}
