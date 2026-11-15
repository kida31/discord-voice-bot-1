import {createHash} from "node:crypto";
import {
    mkdir,
    readFile,
    rename,
    stat,
    unlink,
    writeFile,
} from "node:fs/promises";
import {join, resolve} from "node:path";
import type {TTSRequestContext} from "@lib/tts/audio-provider/type";

export type TTSAudioCacheKey = {
    provider: string;
    sentence: string;
    voiceId?: string;
    language?: string;
    model?: string;
    outputFormat?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
};

export type TTSAudioCacheUser = TTSRequestContext & {
    firstUsedAt: string;
    lastUsedAt: string;
};

export type TTSAudioCacheMetadata = {
    cacheId: string;
    extension: string;
    key: TTSAudioCacheKey;
    createdAt: string;
    lastUsedAt: string;
    users: TTSAudioCacheUser[];
};

type CacheResult = {
    path: string;
    hit: boolean;
};

const CACHE_DIRECTORY = resolve(process.cwd(), "cache", "tts");
const inFlightRequests = new Map<string, Promise<CacheResult>>();

function normalizeCacheKey(key: TTSAudioCacheKey): TTSAudioCacheKey {
    return {
        provider: key.provider.trim(),
        sentence: key.sentence.trim(),
        ...(key.voiceId !== undefined ? {voiceId: key.voiceId} : {}),
        ...(key.language !== undefined ? {language: key.language} : {}),
        ...(key.model !== undefined ? {model: key.model} : {}),
        ...(key.outputFormat !== undefined ? {outputFormat: key.outputFormat} : {}),
        ...(key.stability !== undefined ? {stability: key.stability} : {}),
        ...(key.similarityBoost !== undefined ? {similarityBoost: key.similarityBoost} : {}),
        ...(key.style !== undefined ? {style: key.style} : {}),
        ...(key.speakerBoost !== undefined ? {speakerBoost: key.speakerBoost} : {}),
    };
}

function createCacheHash(key: TTSAudioCacheKey): string {
    return createHash("sha256")
        .update(JSON.stringify(normalizeCacheKey(key)))
        .digest("hex");
}

async function isUsableCacheFile(filePath: string): Promise<boolean> {
    try {
        const fileStats = await stat(filePath);
        return fileStats.isFile() && fileStats.size > 0;
    } catch {
        return false;
    }
}

async function safelyDelete(filePath: string): Promise<void> {
    try {
        await unlink(filePath);
    } catch {
        // File may not exist.
    }
}

async function readMetadata(filePath: string): Promise<TTSAudioCacheMetadata | null> {
    try {
        return JSON.parse(await readFile(filePath, "utf8")) as TTSAudioCacheMetadata;
    } catch {
        return null;
    }
}

async function updateMetadata(
    cacheId: string,
    extension: string,
    key: TTSAudioCacheKey,
    context?: TTSRequestContext,
): Promise<void> {
    const metadataPath = join(CACHE_DIRECTORY, `${cacheId}.json`);
    const now = new Date().toISOString();
    const existing = await readMetadata(metadataPath);
    const users = [...(existing?.users ?? [])];

    if (context) {
        const index = users.findIndex((user) =>
            user.guildId === context.guildId && user.userId === context.userId
        );
        if (index >= 0) {
            users[index] = {
                ...users[index]!,
                username: context.username,
                displayName: context.displayName,
                lastUsedAt: now,
            };
        } else {
            users.push({...context, firstUsedAt: now, lastUsedAt: now});
        }
    }

    const metadata: TTSAudioCacheMetadata = {
        cacheId,
        extension,
        key: normalizeCacheKey(key),
        createdAt: existing?.createdAt ?? now,
        lastUsedAt: now,
        users,
    };
    const temporaryPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(metadata, null, 2), "utf8");
    await rename(temporaryPath, metadataPath);
}

export async function getCachedAudioPath(
    key: TTSAudioCacheKey,
    extension = "ogg",
): Promise<string | null> {
    const filePath = join(CACHE_DIRECTORY, `${createCacheHash(key)}.${extension}`);
    return await isUsableCacheFile(filePath) ? filePath : null;
}

export async function getOrCreateCachedAudio(
    key: TTSAudioCacheKey,
    createAudio: () => Promise<Buffer>,
    extension = "ogg",
    context?: TTSRequestContext,
): Promise<CacheResult> {
    await mkdir(CACHE_DIRECTORY, {recursive: true});
    const hash = createCacheHash(key);
    const filePath = join(CACHE_DIRECTORY, `${hash}.${extension}`);

    if (await isUsableCacheFile(filePath)) {
        await updateMetadata(hash, extension, key, context);
        console.log(`[TTS cache] HIT ${hash.slice(0, 12)} for "${key.sentence}"`);
        return {path: filePath, hit: true};
    }

    const existingRequest = inFlightRequests.get(hash);
    if (existingRequest) {
        const result = await existingRequest;
        await updateMetadata(hash, extension, key, context);
        return result;
    }

    const request = (async (): Promise<CacheResult> => {
        const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        try {
            const audio = await createAudio();
            if (audio.length === 0) {
                throw new Error("TTS provider returned an empty audio buffer");
            }
            await writeFile(temporaryPath, audio, {flag: "wx"});
            await rename(temporaryPath, filePath);
            await updateMetadata(hash, extension, key, context);
            return {path: filePath, hit: false};
        } catch (error) {
            await safelyDelete(temporaryPath);
            throw error;
        } finally {
            inFlightRequests.delete(hash);
        }
    })();

    inFlightRequests.set(hash, request);
    return request;
}

export async function readCachedAudio(
    key: TTSAudioCacheKey,
    extension = "ogg",
): Promise<Buffer | null> {
    const filePath = await getCachedAudioPath(key, extension);
    return filePath ? readFile(filePath) : null;
}

export function getTTSAudioCacheDirectory(): string {
    return CACHE_DIRECTORY;
}
