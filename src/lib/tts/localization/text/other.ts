import {de} from "@lib/tts/localization/text/common";
import type {TemplateMapping} from "@lib/tts/localization/text/template";

export const alpha = {
    name: "Gen Alpha",
    join: "{0} is locked in for real",
} satisfies TemplateMapping;

export const oliver = {
    name: "Oliver",
    join: "Yooo {0} lets gooo!",
    leave: "{0} der Verräter ist gegangen."
} satisfies TemplateMapping;

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
