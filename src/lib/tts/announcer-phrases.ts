import type { LanguageCode } from "./tts-stuff";

export function memberLeftChannel(name: string, language: LanguageCode = "en") {
  switch (language) {
    case "vi-VN":
      return `${name} đã rời khỏi Channel của bạn.`;
    case "en":
      return `${name} left your channel.`;
    case "de-DE":
      return `${name} hat den Channel verlassen.`;
    default:
      console.warn("Language code not implemented:", language);
      return memberLeftChannel(name, "en");
  }
}

export function memberJoinedChannel(
  name: string,
  language: LanguageCode = "en",
) {
  switch (language) {
    case "en":
      return `${name} joined your channel.`;
    case "vi-VN":
      return `${name} đã tham gia channel của bạn.`;
    case "de-DE":
      return `${name} ist dem Channel beigetreten.`;
    default:
      console.warn("Language code not implemented:", language);
      return memberJoinedChannel(name, "en");
  }
}
