import type {Voice, VoiceId} from "@lib/tts/audio-provider/eleven-labs/type";

export const VOICES = {
    "english_female": {
        id: "XJ2fW4ybq7HouelYYGcL" as VoiceId,
        name: "English",
        compatibleLanguages: ["en"],
        description: "English Female v2",
    } /* as const */,
    "german": {
        id: "WHC0PNPIwjx2cCk34Hm8" as VoiceId,
        name: "BRD Sprecher",
        compatibleLanguages: ["de"],
        description: "German",
    },
    "japanese": {
        id: "oAlEJuW30knHWhA6cF0e" as VoiceId,
        name: "日本語アナウンサー",
        compatibleLanguages: ["ja"],
        description: "Japanese",
    },
    "vietnamese": {
        id: "N0Z0aL8qHhzwUHwRBcVo" as VoiceId,
        name: "VTV4",
        compatibleLanguages: ["vi"],
        description: "Vietnamese",
    },
    "korean": {
        id: "aiUUgjHa4mpHf6UenZuf" as VoiceId,
        name: "아나운서",
        compatibleLanguages: ["ko"],
        description: "Korean",
    },
    "oliver": {
        id: "fQV5Nz63N4V4PWc9zMpt" as VoiceId,
        name: "E-Sportler #1",
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