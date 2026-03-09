export type TextEventTypeThingie = "join" | "leave" | "muted" | "unmuted";
export type TemplateMapping = { [key in TextEventTypeThingie]: string }
