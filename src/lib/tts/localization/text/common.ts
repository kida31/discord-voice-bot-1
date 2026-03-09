/**
 * If this file gets too long, split languages in own files.
 * If possible export files as json for runtime flexibility
 * */
import type {TemplateMapping} from "@lib/tts/localization/text/template";

export const en = {
    join: "{0} joined the channel",
    leave: "{0} left the channel",
    muted: "{0} is muted",
    unmuted: "{0} is unmuted",
} satisfies Required<TemplateMapping> // NOT PARTIAL, English is the default and should have all templates defined

export const de = {
    join: "{0} ist dem Channel beigetreten",
    leave: "{0} hat den Channel verlassen",
    muted: "{0} ist stummgeschaltet",
    unmuted: "{0} ist nicht mehr stummgeschaltet",
} satisfies Partial<TemplateMapping>;

export const vi = {
    join: "{0} đã tham gia channel",
    leave: "{0} đã rời khỏi channel",
    muted: "{0} đã tắt tiếng cho mình.",
    unmuted: "{0} đã bật tiếng cho mình.",
} satisfies Partial<TemplateMapping>;

export const ko = {
    join: "{0} 채널에 합류했습니다",
    leave: "{0} 엘리트층을 떠났다",
    muted: "{0} 스스로 음소거했습니다.",
    unmuted: "{0} 스스로 음소거 해제했습니다.",
} satisfies Partial<TemplateMapping>;

export const ja = {
    join: "{0} チャンネルに参加しました。",
    leave: "{0} チャンネルを離れました",
    muted: "{0} 自分でミュートしました。",
    unmuted: "{0} 自分でミュートを解除しました。",
} satisfies Partial<TemplateMapping>;

export default {
    en,
    de,
    vi,
    ko,
    ja,
}
