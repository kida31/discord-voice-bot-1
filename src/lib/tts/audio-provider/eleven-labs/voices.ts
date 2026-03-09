import type {Voice, VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";

export const VOICES = [
    {
        id: "000" as VoiceId,
        name: "English Female",
        key: "eVItLK1UvXctxuaRV2Oq",
        compatibleLanguages: ["en"],
    } /* as const */,
    {
        id: "001" as VoiceId,
        name: "German",
        key: "xLCJR8xcZX2YjImGFyGw",
        compatibleLanguages: ["de"],
    },
    {
        id: "002" as VoiceId,
        name: "Japanese",
        key: "ngvNHfiCrXLPAHcTrZK1",
        compatibleLanguages: ["ja"],
    },
    {
        id: "003" as VoiceId,
        name: "Vietnamese",
        key: "a3AkyqGG4v8Pg7SWQ0Y3",
        compatibleLanguages: ["vi"],
    },
    {
        id: "004" as VoiceId,
        name: "Korean",
        key: "XJ2fW4ybq7HouelYYGcL",
        compatibleLanguages: ["ko"],
    },
    {
        id: "005" as VoiceId,
        name: "German (Swiss, not really)",
        key: "fQV5Nz63N4V4PWc9zMpt",
        compatibleLanguages: ["de"],
    },
    {
        id: "006" as VoiceId,
        name: "Oliver",
        key: "fQV5Nz63N4V4PWc9zMpt",
        compatibleLanguages: ["de"],
    },
    {
        id: "007" as VoiceId,
        name: "???Brazilian Portuguese???",
        key: "ZtXh8n9l7sL1v2m5o3qJ",
        compatibleLanguages: ["pt"],
    }
] as const satisfies Voice[];

export function byName(name: string): Voice | undefined {
    return VOICES.find(v => v.name === name);
}

export function byKey(key: string): Voice | undefined {
    return VOICES.find(v => v.key === key);
}

export function byId(id: VoiceId): Voice {
    return VOICES.find(v => v.id === id)!;
}
