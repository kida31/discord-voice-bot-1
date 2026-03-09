/** If this file gets too long, split languages in own files */


import type {TemplateMapping} from "@lib/tts/localization/text/type";

export const en = {
    join: "{0} joined the voice channel",
    leave: "{0} left the voice channel",
    muted: "{0} is muted",
    unmuted: "{0} is unmuted",
} satisfies TemplateMapping

export const de = {
    join: "{0} ist dem Channel beigetreten",
    leave: "{0} hat den Channel verlassen",
    muted: "{0} ist stummgeschaltet",
    unmuted: "{0} ist nicht mehr stummgeschaltet",
} satisfies Partial<TemplateMapping>;

export const vi = {
    // "welcome": "Chào mừng bạn đến với ứng dụng của chúng tôi!",
    // "goodbye": "Tạm biệt! Hẹn gặp lại sau.",
    // "thank_you": "Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.",
    // "error_occurred": "Đã xảy ra lỗi. Vui lòng thử lại sau.",
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