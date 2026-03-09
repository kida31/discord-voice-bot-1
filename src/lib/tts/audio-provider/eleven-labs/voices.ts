import type {Voice, VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";

export const VOICES = {
    "english_female": {
        id: "eVItLK1UvXctxuaRV2Oq" as VoiceId,
        name: "English Female",
        compatibleLanguages: ["en"],
        description: "English Female",
    } /* as const */,
    "german": {
        id: "xLCJR8xcZX2YjImGFyGw" as VoiceId,
        name: "BRD Sprecher",
        compatibleLanguages: ["de"],
        description: "German",
    },
    "japanese": {
        id: "ngvNHfiCrXLPAHcTrZK1" as VoiceId,
        name: "日本語アナウンサー",
        compatibleLanguages: ["ja"],
        description: "Japanese",
    },
    "vietnamese": {
        id: "a3AkyqGG4v8Pg7SWQ0Y3" as VoiceId,
        name: "VTV4",
        compatibleLanguages: ["vi"],
        description: "Vietnamese",
    },
    "korean": {
        id: "XJ2fW4ybq7HouelYYGcL" as VoiceId,
        name: "아나운서",
        compatibleLanguages: ["ko"],
        description: "Korean",
    },
    "oliver": {
        id: "fQV5Nz63N4V4PWc9zMpt" as VoiceId,
        name: "Oliver",
        compatibleLanguages: ["de"],
        description: "Der Allerbeste"
    },
    // "pt": {
    //     id: "ZtXh8n9l7sL1v2m5o3qJ" as VoiceId, // DOES NOT EXIST
    //     name: "???",
    //     compatibleLanguages: ["pt"],
    //     description: "Portuguese (Brazilian)?"
    // }
} as const satisfies { [key: string]: Voice }

// Assert all voices have some compatible language
for (const voice of Object.values(VOICES)) {
    if (voice.compatibleLanguages.length <= 0) {
        throw new Error(`Voice ${voice.name} has no compatible language`);
    }
}

export function voiceByName(name: string): Voice | undefined {
    return Object.values(VOICES).find(v => v.name === name);
}

export function voiceById(id: VoiceId): Voice {
    return Object.values(VOICES).find(v => v.id === id)!;
}

export function voiceByKey(key: keyof typeof VOICES): Voice {
    return VOICES[key]
}