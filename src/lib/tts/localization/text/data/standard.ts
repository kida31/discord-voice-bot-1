import type { LanguageTemplateMapping, TemplateMapping } from "@lib/tts/localization/text/template";

/**
 * List of all text data for different languages.
 * Each language should have the same set of data,
 * but can be more casual or formal depending on the language.
 *
 * If this file gets too long, split languages in own files.
 * If possible export files as json for runtime flexibility
 * */
export default {
    en: {
        name: "English",
        join: "{0} joined the channel",
        leave: "{0} left the channel",
        muted: "{0} is muted",
        unmuted: "{0} is unmuted",
    } as const satisfies Required<TemplateMapping>, // English is the default and should have all data defined
    de: {
        name: "Deutsch",
        join: "{0} ist dem Channel beigetreten",
        leave: "{0} hat den Channel verlassen",
        muted: "{0} ist stummgeschaltet",
        unmuted: "{0} ist nicht mehr stummgeschaltet",
    },
    vi: {
        name: "Tiếng Việt",
        join: "{0} đã tham gia channel",
        leave: "{0} đã rời khỏi channel",
        muted: "{0} đã tắt tiếng cho mình.",
        unmuted: "{0} đã bật tiếng cho mình.",
    },
    ko: {
        name: "한국어",
        join: "{0} 채널에 합류했습니다",
        leave: "{0} 엘리트층을 떠났다",
        muted: "{0} 스스로 음소거했습니다.",
        unmuted: "{0} 스스로 음소거 해제했습니다.",
    },
    ja: {
        name: "日本語",
        join: "{0} チャンネルに参加しました。",
        leave: "{0} チャンネルを離れました",
        muted: "{0} 自分でミュートしました。",
        unmuted: "{0} 自分でミュートを解除しました。",
    },
} as const satisfies LanguageTemplateMapping;
