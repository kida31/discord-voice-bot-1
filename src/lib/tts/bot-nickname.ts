import {Collection} from "discord.js";
import type {LanguageCode} from "@lib/tts/localization/lang";
import type {Voice} from "@lib/tts/audio-provider/eleven-labs/type";

const DEFAULT_NICKNAME = "Announcer";

const botNickname: Collection<LanguageCode, string> = new Collection();
botNickname.set("en", "Announcer");
botNickname.set("vi", "VTV4 Announcer");
botNickname.set("de", "BRD Sprecher");
botNickname.set("ja", "日本語アナウンサー");
botNickname.set("ko", "아나운서");

export function getLanguageNickname(l: LanguageCode): string {
    return botNickname.get(l) ?? DEFAULT_NICKNAME;
}

export function getVoiceNickname(voice: Voice): string {
    return voice.name; // Platzhalter-Implementierung
}
