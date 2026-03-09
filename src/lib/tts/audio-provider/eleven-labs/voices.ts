import type {Voice, VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";

export const VOICES = [
    {
        id: "eVItLK1UvXctxuaRV2Oq" as VoiceId,
        name: "English Female",
        compatibleLanguages: ["en"],
    } /* as const */,
    {
        id: "xLCJR8xcZX2YjImGFyGw" as VoiceId,
        name: "German",
        compatibleLanguages: ["de"],
    },
    {
        id: "ngvNHfiCrXLPAHcTrZK1" as VoiceId,
        name: "Japanese",
        compatibleLanguages: ["ja"],
    },
    {
        id: "a3AkyqGG4v8Pg7SWQ0Y3" as VoiceId,
        name: "Vietnamese",
        compatibleLanguages: ["vi"],
    },
    {
        id: "XJ2fW4ybq7HouelYYGcL" as VoiceId,
        name: "Korean",
        compatibleLanguages: ["ko"],
    },
    {
        id: "fQV5Nz63N4V4PWc9zMpt" as VoiceId,
        name: "German (Swiss, not really)",
        compatibleLanguages: ["de"],
    },
    {
        id: "fQV5Nz63N4V4PWc9zMpt" as VoiceId,
        name: "Oliver",
        compatibleLanguages: ["de"],
    },
    {
        name: "???Brazilian Portuguese???",
        id: "ZtXh8n9l7sL1v2m5o3qJ" as VoiceId,
        compatibleLanguages: ["pt"],
    }
] as const satisfies Voice[];

// Assert all voices have some compatible language
for (const voice of VOICES) {
    if (voice.compatibleLanguages.length <= 0) {
        throw new Error(`Voice ${voice.name} has no compatible language`);
    }
}

export function byName(name: string): Voice | undefined {
    return VOICES.find(v => v.name === name);
}

export function byId(id: VoiceId): Voice {
    return VOICES.find(v => v.id === id)!;
}
