import type { LanguageCode } from "./tts-stuff";

export function memberLeftChannel(name: string, language: LanguageCode = "en-US") {
  switch (language) {
    case "vi-VN":
      return `${name} đã rời khỏi Channel của bạn.`;
    case "en-US":
      return `${name} left your channel.`;
    case "de-DE":
      return `${name} hat den Channel verlassen.`;
    case "ja-JP":
      return `${name} チャンネルを離れました`;
    case "ko-KR":
      return `${name} 엘리트층을 떠났다`;
    default:
      console.warn("Language code not implemented:", language);
      return memberLeftChannel(name, "en-US");
  }
}

export function memberJoinedChannel(
  name: string,
  language: LanguageCode = "en-US",
) {
  switch (language) {
    case "en-US":
      return `${name} joined your channel.`;
    case "vi-VN":
      return `${name} đã tham gia channel`;
    case "de-DE":
      return `${name} ist jetzt am Start!`;
    case "ja-JP":
      return `${name} チャンネルに参加しました。`;
    case "ko-KR":      
      return `${name} 채널에 합류했습니다`;
    default:
      console.warn("Language code not implemented:", language);
      return memberJoinedChannel(name, "en-US");
  }
}

export function memberSelfMuted(name: string, language: LanguageCode = "en-US") {
  switch (language) {
    case "en-US":
      return `${name} muted themselves.`;
    case "vi-VN":
      return `${name} đã tắt tiếng cho mình.`;
    case "de-DE":
      return `${name} hat sich gemutet.`;
    case "ja-JP":
      return `${name} 自分でミュートしました。`;
    case "ko-KR":
      return `${name} 스스로 음소거했습니다.`;
    default:
      console.warn("Language code not implemented:", language);
      return memberSelfMuted(name, "en-US");
  }
}

export function memberSelfUnmuted(name: string, language: LanguageCode = "en-US") {
  switch (language) {
    case "en-US":
      return `${name} unmuted themselves.`;
    case "vi-VN":
      return `${name} đã bật tiếng cho mình.`;
    case "de-DE":
      return `${name} hat sich entmutet.`;
    case "ja-JP":
      return `${name} 自分のミュートを解除しました。`;
    case "ko-KR":
      return `${name} 스스로 음소거 해제했습니다.`;
    default:
      console.warn("Language code not implemented:", language);
      return memberSelfUnmuted(name, "en-US");
  }
}