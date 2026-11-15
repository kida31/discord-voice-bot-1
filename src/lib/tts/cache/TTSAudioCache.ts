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

type CacheResult = {
    path: string;
    hit: boolean;
};

const CACHE_DIRECTORY = resolve(
    process.cwd(),
    "cache",
    "tts",
);

const inFlightRequests = new Map<
    string,
    Promise<CacheResult>
>();

function normalizeCacheKey(
    key: TTSAudioCacheKey,
): TTSAudioCacheKey {
    return {
        provider: key.provider.trim(),
        sentence: key.sentence.trim(),
        ...(key.voiceId !== undefined
            ? {voiceId: key.voiceId}
            : {}),
        ...(key.language !== undefined
            ? {language: key.language}
            : {}),
        ...(key.model !== undefined
            ? {model: key.model}
            : {}),
        ...(key.outputFormat !== undefined
            ? {outputFormat: key.outputFormat}
            : {}),
        ...(key.stability !== undefined
            ? {stability: key.stability}
            : {}),
        ...(key.similarityBoost !== undefined
            ? {similarityBoost: key.similarityBoost}
            : {}),
        ...(key.style !== undefined
            ? {style: key.style}
            : {}),
        ...(key.speakerBoost !== undefined
            ? {speakerBoost: key.speakerBoost}
            : {}),
    };
}

function createCacheHash(
    key: TTSAudioCacheKey,
): string {
    const normalizedKey =
        normalizeCacheKey(key);

    return createHash("sha256")
        .update(JSON.stringify(normalizedKey))
        .digest("hex");
}

async function isUsableCacheFile(
    filePath: string,
): Promise<boolean> {
    try {
        const fileStats = await stat(filePath);

        return (
            fileStats.isFile() &&
            fileStats.size > 0
        );
    } catch {
        return false;
    }
}

async function safelyDelete(
    filePath: string,
): Promise<void> {
    try {
        await unlink(filePath);
    } catch {
        // File may not exist. Nothing to clean up.
    }
}

export async function getCachedAudioPath(
    key: TTSAudioCacheKey,
    extension = "ogg",
): Promise<string | null> {
    const hash = createCacheHash(key);

    const filePath = join(
        CACHE_DIRECTORY,
        `${hash}.${extension}`,
    );

    return await isUsableCacheFile(filePath)
        ? filePath
        : null;
}

export async function getOrCreateCachedAudio(
    key: TTSAudioCacheKey,
    createAudio: () => Promise<Buffer>,
    extension = "ogg",
): Promise<CacheResult> {
    await mkdir(
        CACHE_DIRECTORY,
        {recursive: true},
    );

    const hash = createCacheHash(key);

    const filePath = join(
        CACHE_DIRECTORY,
        `${hash}.${extension}`,
    );

    if (await isUsableCacheFile(filePath)) {
        console.log(
            `[TTS cache] HIT ${hash.slice(0, 12)} `
            + `for "${key.sentence}"`,
        );

        return {
            path: filePath,
            hit: true,
        };
    }

    const existingRequest =
        inFlightRequests.get(hash);

    if (existingRequest) {
        console.log(
            `[TTS cache] WAIT ${hash.slice(0, 12)} `
            + `for "${key.sentence}"`,
        );

        return existingRequest;
    }

    const request = (async (): Promise<CacheResult> => {
        const temporaryPath =
            `${filePath}.${process.pid}.${Date.now()}.tmp`;

        try {
            console.log(
                `[TTS cache] MISS ${hash.slice(0, 12)} `
                + `for "${key.sentence}"`,
            );

            const audio = await createAudio();

            if (audio.length === 0) {
                throw new Error(
                    "TTS provider returned an empty audio buffer",
                );
            }

            await writeFile(
                temporaryPath,
                audio,
                {flag: "wx"},
            );

            await rename(
                temporaryPath,
                filePath,
            );

            return {
                path: filePath,
                hit: false,
            };
        } catch (error) {
            await safelyDelete(temporaryPath);
            throw error;
        } finally {
            inFlightRequests.delete(hash);
        }
    })();

    inFlightRequests.set(
        hash,
        request,
    );

    return request;
}

export async function readCachedAudio(
    key: TTSAudioCacheKey,
    extension = "ogg",
): Promise<Buffer | null> {
    const filePath = await getCachedAudioPath(
        key,
        extension,
    );

    if (!filePath) {
        return null;
    }

    return readFile(filePath);
}

export function getTTSAudioCacheDirectory(): string {
    return CACHE_DIRECTORY;
}