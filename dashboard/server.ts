import "dotenv/config";

import Fastify, {
    type FastifyRequest,
} from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import Database from "better-sqlite3";
import {randomBytes, randomUUID} from "node:crypto";
import {mkdir, readdir, readFile, stat, unlink} from "node:fs/promises";
import {join} from "node:path";

import {
    ALIAS_MAX_LENGTH,
    deleteAlias,
    getAlias,
    setAlias,
} from "../src/lib/tts/member-alias";

import {
    VOICES,
} from "../src/lib/tts/audio-provider/eleven-labs/voices";
import {
    getTTSAudioCacheDirectory,
} from "../src/lib/tts/cache/TTSAudioCache";

/* ==============================================================
 * Configuration
 * ==============================================================
 */

const DASHBOARD_URL =
    process.env["DASHBOARD_URL"]
    ?? "http://localhost:5173";

const SESSION_COOKIE =
    "lfants_session";

const USE_SECURE_COOKIES =
    DASHBOARD_URL.startsWith("https://");

const SESSION_MAX_AGE_SECONDS =
    60 * 60 * 24 * 7;

const OAUTH_STATE_MAX_AGE_MS =
    10 * 60 * 1000;

const dashboardStartedAt =
    Date.now();

const DISCORD_API_URL =
    "https://discord.com/api/v10";

const DISCORD_AUTHORIZATION_URL =
    "https://discord.com/oauth2/authorize";

const DISCORD_ADMINISTRATOR_PERMISSION =
    1n << 3n;

const clientId =
    process.env["DISCORD_CLIENT_ID"];

const clientSecret =
    process.env["DISCORD_CLIENT_SECRET"];

const redirectUri =
    process.env["DISCORD_REDIRECT_URI"];

const guildId =
    process.env["DISCORD_GUILD_ID"];

const botToken =
    process.env["DISCORD_BOT_TOKEN"];

const sqliteFile =
    process.env["SQLITE_FILE"]
    ?? "database.db";

if (!clientId) {
    throw new Error(
        "Missing DISCORD_CLIENT_ID",
    );
}

if (!clientSecret) {
    throw new Error(
        "Missing DISCORD_CLIENT_SECRET",
    );
}

if (!redirectUri) {
    throw new Error(
        "Missing DISCORD_REDIRECT_URI",
    );
}

if (!guildId) {
    throw new Error(
        "Missing DISCORD_GUILD_ID",
    );
}

if (!botToken) {
    throw new Error(
        "Missing DISCORD_BOT_TOKEN",
    );
}

/* ==============================================================
 * Types
 * ==============================================================
 */

type DiscordUser = {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
    bot?: boolean;
};

type DiscordGuild = {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
};

type DiscordGuildMember = {
    user: DiscordUser;
    nick: string | null;
    avatar: string | null;
};

type Session = {
    user: DiscordUser;
    isAdmin: boolean;
    guildName: string | null;
    guildIcon: string | null;
    createdAt: number;
};

type DiscordTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
};

type AdminAliasBody = {
    alias?: string;
};

type StringKeyValueRow = {
    value: string;
};

type StoredGuildConfig = {
    guildId?: string;
    voiceLanguage?: string;
    textLanguage?: string;
    elevenLabsVoiceId?: string;
    aliases?: Record<string, string>;
};

type CacheDeleteBody = {
    ids?: string[];
    all?: boolean;
};

type VoicePreviewBody = {
    text?: string;
    language?: string;
};

type AuditEventRow = {
    id: string;
    guild_id: string;
    event_type: string;
    category: string;
    actor_user_id: string | null;
    actor_username: string | null;
    actor_display_name: string | null;
    target_id: string | null;
    target_name: string | null;
    data_json: string | null;
    created_at: string;
};

type CacheMetadata = {
    cacheId?: string;
    extension?: string;
    key?: {
        provider?: string;
        sentence?: string;
        voiceId?: string;
        language?: string;
        model?: string;
    };
    createdAt?: string;
    lastUsedAt?: string;
    users?: Array<{
        guildId: string;
        userId: string;
        username: string;
        displayName: string;
        firstUsedAt: string;
        lastUsedAt: string;
    }>;
};

/* ==============================================================
 * In-memory session storage
 * ==============================================================
 */

const sessions =
    new Map<string, Session>();

const oauthStates =
    new Map<string, number>();

function isSessionExpired(
    session: Session,
): boolean {
    const maximumAgeMilliseconds =
        SESSION_MAX_AGE_SECONDS * 1000;

    return (
        Date.now() -
        session.createdAt >
        maximumAgeMilliseconds
    );
}

function getSession(
    request: FastifyRequest,
): Session | null {
    const sessionId =
        request.cookies[
            SESSION_COOKIE
        ];

    if (!sessionId) {
        return null;
    }

    const session =
        sessions.get(sessionId);

    if (!session) {
        return null;
    }

    if (isSessionExpired(session)) {
        sessions.delete(sessionId);
        return null;
    }

    return session;
}

function getSessionUser(
    request: FastifyRequest,
): DiscordUser | null {
    return getSession(request)?.user ?? null;
}

function requireSession(
    request: FastifyRequest,
): Session | null {
    return getSession(request);
}

function requireGuildMemberSession(
    request: FastifyRequest,
): Session | null {
    const session =
        getSession(request);

    if (!session?.guildName) {
        return null;
    }

    return session;
}

function requireAdminSession(
    request: FastifyRequest,
): Session | null {
    const session =
        getSession(request);

    if (!session?.isAdmin) {
        return null;
    }

    return session;
}

/* ==============================================================
 * Audit log
 * ==============================================================
 */

function withWritableDatabase<T>(callback: (database: Database.Database) => T): T {
    const database = new Database(sqliteFile);
    try {
        database.pragma("journal_mode = WAL");
        database.exec(`
            CREATE TABLE IF NOT EXISTS dashboard_event_log (
                id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                category TEXT NOT NULL,
                actor_user_id TEXT,
                actor_username TEXT,
                actor_display_name TEXT,
                target_id TEXT,
                target_name TEXT,
                data_json TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_dashboard_event_log_guild_created
                ON dashboard_event_log (guild_id, created_at DESC);
        `);
        return callback(database);
    } finally {
        database.close();
    }
}

function writeAuditEvent(options: {
    session: Session;
    eventType: string;
    category: string;
    targetId?: string | null;
    targetName?: string | null;
    data?: unknown;
}): void {
    withWritableDatabase((database) => {
        database.prepare(`
            INSERT INTO dashboard_event_log (
                id, guild_id, event_type, category,
                actor_user_id, actor_username, actor_display_name,
                target_id, target_name, data_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            randomUUID(),
            guildId,
            options.eventType,
            options.category,
            options.session.user.id,
            options.session.user.username,
            options.session.user.global_name ?? options.session.user.username,
            options.targetId ?? null,
            options.targetName ?? null,
            options.data === undefined ? null : JSON.stringify(options.data),
            new Date().toISOString(),
        );
    });
}

function readAuditEvents(limit = 100): AuditEventRow[] {
    return withWritableDatabase((database) => database.prepare(`
        SELECT *
        FROM dashboard_event_log
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(guildId, Math.min(Math.max(limit, 1), 500)) as AuditEventRow[]);
}

/* ==============================================================
 * General helpers
 * ==============================================================
 */

function createRandomToken(): string {
    return randomBytes(32)
        .toString("hex");
}

function cleanupExpiredStates(): void {
    const now =
        Date.now();

    for (const [
        state,
        createdAt,
    ] of oauthStates) {
        if (
            now - createdAt >
            OAUTH_STATE_MAX_AGE_MS
        ) {
            oauthStates.delete(state);
        }
    }
}

function cleanupExpiredSessions(): void {
    for (const [
        sessionId,
        session,
    ] of sessions) {
        if (isSessionExpired(session)) {
            sessions.delete(sessionId);
        }
    }
}

function getDiscordAvatarUrl(
    user: DiscordUser,
): string | null {
    if (!user.avatar) {
        return null;
    }

    return (
        "https://cdn.discordapp.com/avatars/"
        + `${user.id}/${user.avatar}.png`
        + "?size=128"
    );
}

function getDiscordGuildIconUrl(
    guildIdValue: string,
    icon: string | null,
): string | null {
    if (!icon) {
        return null;
    }

    const extension =
        icon.startsWith("a_")
            ? "gif"
            : "png";

    return (
        "https://cdn.discordapp.com/icons/"
        + `${guildIdValue}/${icon}.${extension}`
        + "?size=128"
    );
}

function getGuildMemberAvatarUrl(
    member: DiscordGuildMember,
): string | null {
    if (member.avatar) {
        return (
            "https://cdn.discordapp.com/guilds/"
            + `${guildId}/users/`
            + `${member.user.id}/avatars/`
            + `${member.avatar}.png`
            + "?size=128"
        );
    }

    return getDiscordAvatarUrl(
        member.user,
    );
}

function getGuildMemberDisplayName(
    member: DiscordGuildMember,
): string {
    return (
        member.nick
        ?? member.user.global_name
        ?? member.user.username
    );
}

function hasAdministratorPermission(
    permissions: string,
): boolean {
    try {
        const permissionBits =
            BigInt(permissions);

        return (
            permissionBits &
            DISCORD_ADMINISTRATOR_PERMISSION
        ) ===
            DISCORD_ADMINISTRATOR_PERMISSION;
    } catch {
        return false;
    }
}

function isGuildAdministrator(
    guild: DiscordGuild | undefined,
): boolean {
    if (!guild) {
        return false;
    }

    return (
        guild.owner ||
        hasAdministratorPermission(
            guild.permissions,
        )
    );
}

/* ==============================================================
 * Read-only guild configuration
 * ==============================================================
 */

function getStoredGuildConfig():
    StoredGuildConfig | null {
    const database =
        new Database(
            sqliteFile,
            {
                readonly: true,
                fileMustExist: true,
            },
        );

    try {
        const key =
            `tts/guild-announcer-config/${guildId}`;

        const statement =
            database.prepare(
                `
                    SELECT value
                    FROM stringkeyvalue
                    WHERE key = ?
                `,
            );

        const row =
            statement.get(
                key,
            ) as StringKeyValueRow | undefined;

        if (!row) {
            return null;
        }

        const parsed =
            JSON.parse(
                row.value,
            ) as StoredGuildConfig;

        return parsed;
    } finally {
        database.close();
    }
}

function getConfiguredVoiceId():
    string | null {
    const config =
        getStoredGuildConfig();

    const voiceId =
        config?.elevenLabsVoiceId;

    if (
        typeof voiceId !== "string" ||
        voiceId.trim().length === 0
    ) {
        return null;
    }

    return voiceId.trim();
}

function isValidCacheId(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
}

async function safelyUnlink(filePath: string): Promise<boolean> {
    try {
        await unlink(filePath);
        return true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
            return false;
        }
        throw error;
    }
}

async function listCacheEntries() {
    const directory = getTTSAudioCacheDirectory();
    await mkdir(directory, {recursive: true});
    const names = await readdir(directory);
    const audioNames = names.filter((name) => /^[a-f0-9]{64}\.[a-z0-9]+$/i.test(name));
    const entries = [];

    for (const audioName of audioNames) {
        const separator = audioName.lastIndexOf(".");
        const id = audioName.slice(0, separator);
        const extension = audioName.slice(separator + 1);
        if (!isValidCacheId(id) || extension === "json" || extension === "tmp") {
            continue;
        }

        const audioPath = join(directory, audioName);
        const fileStats = await stat(audioPath);
        if (!fileStats.isFile() || fileStats.size <= 0) {
            continue;
        }

        let metadata: CacheMetadata | null = null;
        try {
            metadata = JSON.parse(
                await readFile(join(directory, `${id}.json`), "utf8"),
            ) as CacheMetadata;
        } catch {
            metadata = null;
        }

        entries.push({
            id,
            extension,
            sizeBytes: fileStats.size,
            createdAt: metadata?.createdAt ?? fileStats.birthtime.toISOString(),
            lastUsedAt: metadata?.lastUsedAt ?? fileStats.mtime.toISOString(),
            provider: metadata?.key?.provider ?? null,
            sentence: metadata?.key?.sentence ?? null,
            voiceId: metadata?.key?.voiceId ?? null,
            language: metadata?.key?.language ?? null,
            model: metadata?.key?.model ?? null,
            users: metadata?.users ?? [],
            legacy: metadata === null,
        });
    }

    entries.sort((first, second) =>
        second.lastUsedAt.localeCompare(first.lastUsedAt)
    );
    return {directory, entries};
}

/* ==============================================================
 * Discord members
 * ==============================================================
 */

async function fetchDiscordGuildMembers(
    request: FastifyRequest,
): Promise<DiscordGuildMember[]> {
    const members: DiscordGuildMember[] = [];

    let after = "0";

    for (;;) {
        const params =
            new URLSearchParams({
                limit: "1000",
                after,
            });

        const response =
            await fetch(
                `${DISCORD_API_URL}/guilds/${guildId}/members?${params.toString()}`,
                {
                    headers: {
                        Authorization:
                            `Bot ${botToken}`,
                    },
                },
            );

        if (!response.ok) {
            const body =
                await response.text();

            request.log.error(
                {
                    status:
                        response.status,
                    body,
                },
                "Failed to retrieve Discord guild members",
            );

            throw new Error(
                `Discord member request failed with ${response.status}`,
            );
        }

        const page = await response.json() as DiscordGuildMember[];

        members.push(...page);

        if (page.length < 1000) {
            break;
        }

        const lastMember =
            page.at(-1);

        if (!lastMember) {
            break;
        }

        after =
            lastMember.user.id;
    }

    return members;
}

/* ==============================================================
 * Fastify setup
 * ==============================================================
 */

const app = Fastify({
    logger: true,
});

await app.register(cors, {
    origin: DASHBOARD_URL,
    credentials: true,
    methods: [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allowedHeaders: [
        "Content-Type",
    ],
});

await app.register(cookie);

/* ==============================================================
 * Public dashboard branding
 * ==============================================================
 */

app.get(
    "/api/public/branding",
    async (request) => {
        try {
            const response = await fetch(
                `${DISCORD_API_URL}/guilds/${guildId}`,
                {
                    headers: {
                        Authorization: `Bot ${botToken}`,
                    },
                },
            );

            if (!response.ok) {
                return {guildName: "L-F-Ants", iconUrl: null};
            }

            const guild = await response.json() as {
                id: string;
                name: string;
                icon: string | null;
            };

            return {
                guildName: guild.name,
                iconUrl: getDiscordGuildIconUrl(guild.id, guild.icon),
            };
        } catch (error) {
            request.log.warn({error}, "Could not load public guild branding");
            return {guildName: "L-F-Ants", iconUrl: null};
        }
    },
);

/* ==============================================================
 * Health
 * ==============================================================
 */

app.get(
    "/api/health",
    async () => {
        return {
            status: "ok",
            service:
                "L-F-Ants Dashboard API",
            timestamp:
                new Date().toISOString(),
            startedAt:
                new Date(dashboardStartedAt).toISOString(),
            uptimeSeconds:
                Math.floor((Date.now() - dashboardStartedAt) / 1000),
        };
    },
);

/* ==============================================================
 * Discord OAuth login
 * ==============================================================
 */

app.get(
    "/auth/discord",
    async (_request, reply) => {
        cleanupExpiredStates();
        cleanupExpiredSessions();

        const state =
            createRandomToken();

        oauthStates.set(
            state,
            Date.now(),
        );

        const params =
            new URLSearchParams({
                client_id:
                    clientId,
                response_type:
                    "code",
                redirect_uri:
                    redirectUri,
                scope:
                    "identify guilds",
                state,
                prompt:
                    "consent",
            });

        return reply.redirect(
            `${DISCORD_AUTHORIZATION_URL}?${params.toString()}`,
        );
    },
);

/* ==============================================================
 * Discord OAuth callback
 * ==============================================================
 */

app.get<{
    Querystring: {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
    };
}>(
    "/auth/discord/callback",
    async (request, reply) => {
        const {
            code,
            state,
            error,
            error_description,
        } = request.query;

        if (error) {
            request.log.warn(
                {
                    error,
                    errorDescription:
                        error_description,
                },
                "Discord OAuth rejected",
            );

            return reply.redirect(
                `${DASHBOARD_URL}/?login=denied`,
            );
        }

        if (!code || !state) {
            return reply
                .code(400)
                .send({
                    error:
                        "Missing OAuth code or state",
                });
        }

        const stateCreatedAt =
            oauthStates.get(state);

        oauthStates.delete(state);

        if (!stateCreatedAt) {
            return reply
                .code(400)
                .send({
                    error:
                        "Invalid OAuth state",
                });
        }

        if (
            Date.now() -
            stateCreatedAt >
            OAUTH_STATE_MAX_AGE_MS
        ) {
            return reply
                .code(400)
                .send({
                    error:
                        "Expired OAuth state",
                });
        }

        const tokenBody =
            new URLSearchParams({
                client_id:
                    clientId,
                client_secret:
                    clientSecret,
                grant_type:
                    "authorization_code",
                code,
                redirect_uri:
                    redirectUri,
            });

        const tokenResponse =
            await fetch(
                `${DISCORD_API_URL}/oauth2/token`,
                {
                    method:
                        "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded",
                    },
                    body:
                        tokenBody.toString(),
                },
            );

        if (!tokenResponse.ok) {
            const body =
                await tokenResponse.text();

            request.log.error(
                {
                    status:
                        tokenResponse.status,
                    body,
                },
                "Discord token exchange failed",
            );

            return reply
                .code(502)
                .send({
                    error:
                        "Discord token exchange failed",
                });
        }

        const tokenData = await tokenResponse.json() as DiscordTokenResponse;

        const [
            userResponse,
            guildsResponse,
        ] = await Promise.all([
            fetch(
                `${DISCORD_API_URL}/users/@me`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${tokenData.access_token}`,
                    },
                },
            ),
            fetch(
                `${DISCORD_API_URL}/users/@me/guilds`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${tokenData.access_token}`,
                    },
                },
            ),
        ]);

        if (!userResponse.ok) {
            const body =
                await userResponse.text();

            request.log.error(
                {
                    status:
                        userResponse.status,
                    body,
                },
                "Discord user request failed",
            );

            return reply
                .code(502)
                .send({
                    error:
                        "Failed to retrieve Discord user",
                });
        }

        if (!guildsResponse.ok) {
            const body =
                await guildsResponse.text();

            request.log.error(
                {
                    status:
                        guildsResponse.status,
                    body,
                },
                "Discord guild request failed",
            );

            return reply
                .code(502)
                .send({
                    error:
                        "Failed to retrieve Discord guilds",
                });
        }

        const user = await userResponse.json() as DiscordUser;

        const guilds = await guildsResponse.json() as DiscordGuild[];

        const dashboardGuild =
            guilds.find(
                (guild) =>
                    guild.id === guildId,
            );

        const isAdmin =
            isGuildAdministrator(
                dashboardGuild,
            );

        request.log.info(
            {
                userId:
                    user.id,
                guildId,
                isGuildMember:
                    dashboardGuild !==
                    undefined,
                isAdmin,
            },
            "Discord OAuth login successful",
        );

        const sessionId =
            createRandomToken();

        sessions.set(
            sessionId,
            {
                user,
                isAdmin,
                guildName:
                    dashboardGuild?.name
                    ?? null,
                guildIcon:
                    dashboardGuild?.icon
                    ?? null,
                createdAt:
                    Date.now(),
            },
        );

        reply.setCookie(
            SESSION_COOKIE,
            sessionId,
            {
                httpOnly:
                    true,
                sameSite:
                    "lax",
                secure:
                    USE_SECURE_COOKIES,
                path:
                    "/",
                maxAge:
                    SESSION_MAX_AGE_SECONDS,
            },
        );

        return reply.redirect(
            `${DASHBOARD_URL}/?login=success`,
        );
    },
);

/* ==============================================================
 * Current authenticated user
 * ==============================================================
 */

app.get(
    "/api/me",
    async (request, reply) => {
        const session =
            requireSession(request);

        if (!session) {
            reply.clearCookie(
                SESSION_COOKIE,
                {
                    path: "/",
                },
            );

            return reply
                .code(401)
                .send({
                    authenticated:
                        false,
                });
        }

        return {
            authenticated:
                true,
            user: {
                id:
                    session.user.id,
                username:
                    session.user.username,
                displayName:
                    session.user.global_name
                    ?? session.user.username,
                avatarUrl:
                    getDiscordAvatarUrl(
                        session.user,
                    ),
            },
            guild: {
                id:
                    guildId,
                name:
                    session.guildName,
                iconUrl:
                    getDiscordGuildIconUrl(
                        guildId,
                        session.guildIcon,
                    ),
                isMember:
                    session.guildName !==
                    null,
                isAdmin:
                    session.isAdmin,
            },
        };
    },
);

/* ==============================================================
 * Current user's TTS alias
 * ==============================================================
 */

app.get(
    "/api/me/alias",
    async (request, reply) => {
        const user =
            getSessionUser(request);

        if (!user) {
            return reply
                .code(401)
                .send({
                    error:
                        "Not authenticated",
                });
        }

        const alias =
            getAlias(
                guildId,
                user.id,
            );

        return {
            alias:
                alias ?? null,
            maxLength:
                ALIAS_MAX_LENGTH,
        };
    },
);

app.put<{
    Body: {
        alias?: string;
    };
}>(
    "/api/me/alias",
    async (request, reply) => {
        const user =
            getSessionUser(request);

        if (!user) {
            return reply
                .code(401)
                .send({
                    error:
                        "Not authenticated",
                });
        }

        const alias =
            request.body?.alias?.trim();

        if (!alias) {
            return reply
                .code(400)
                .send({
                    error:
                        "Alias must not be empty",
                });
        }

        if (
            alias.length >
            ALIAS_MAX_LENGTH
        ) {
            return reply
                .code(400)
                .send({
                    error:
                        `Alias must not exceed `
                        + `${ALIAS_MAX_LENGTH} characters`,
                });
        }

        setAlias(
            guildId,
            user.id,
            alias,
        );

        return {
            success:
                true,
            alias,
        };
    },
);

app.delete(
    "/api/me/alias",
    async (request, reply) => {
        const user =
            getSessionUser(request);

        if (!user) {
            return reply
                .code(401)
                .send({
                    error:
                        "Not authenticated",
                });
        }

        deleteAlias(
            guildId,
            user.id,
        );

        return {
            success:
                true,
        };
    },
);

/* ==============================================================
 * Admin member management
 * ==============================================================
 */

app.get(
    "/api/admin/members",
    async (request, reply) => {
        const session =
            requireAdminSession(request);

        if (!session) {
            return reply
                .code(403)
                .send({
                    error:
                        "Administrator permission required",
                });
        }

        try {
            const members =
                await fetchDiscordGuildMembers(
                    request,
                );

            const result =
                members
                    .filter(
                        (member) =>
                            member.user.bot !==
                            true,
                    )
                    .map((member) => {
                        const memberAlias =
                            getAlias(
                                guildId,
                                member.user.id,
                            );

                        return {
                            id:
                                member.user.id,
                            username:
                                member.user.username,
                            displayName:
                                getGuildMemberDisplayName(
                                    member,
                                ),
                            avatarUrl:
                                getGuildMemberAvatarUrl(
                                    member,
                                ),
                            alias:
                                memberAlias ?? null,
                        };
                    })
                    .sort(
                        (first, second) =>
                            first.displayName.localeCompare(
                                second.displayName,
                                "de",
                                {
                                    sensitivity:
                                        "base",
                                },
                            ),
                    );

            return {
                members:
                    result,
                count:
                    result.length,
                maxAliasLength:
                    ALIAS_MAX_LENGTH,
            };
        } catch (error) {
            request.log.error(
                {
                    error,
                },
                "Admin member retrieval failed",
            );

            return reply
                .code(502)
                .send({
                    error:
                        "Failed to retrieve Discord guild members",
                });
        }
    },
);

app.put<{
    Params: {
        userId: string;
    };
    Body: AdminAliasBody;
}>(
    "/api/admin/members/:userId/alias",
    async (request, reply) => {
        const session =
            requireAdminSession(request);

        if (!session) {
            return reply
                .code(403)
                .send({
                    error:
                        "Administrator permission required",
                });
        }

        const userId =
            request.params.userId.trim();

        const alias =
            request.body?.alias?.trim();

        if (!userId) {
            return reply
                .code(400)
                .send({
                    error:
                        "Missing Discord user ID",
                });
        }

        if (!alias) {
            return reply
                .code(400)
                .send({
                    error:
                        "Alias must not be empty",
                });
        }

        if (
            alias.length >
            ALIAS_MAX_LENGTH
        ) {
            return reply
                .code(400)
                .send({
                    error:
                        `Alias must not exceed `
                        + `${ALIAS_MAX_LENGTH} characters`,
                });
        }

        setAlias(
            guildId,
            userId,
            alias,
        );

        return {
            success:
                true,
            userId,
            alias,
        };
    },
);

app.delete<{
    Params: {
        userId: string;
    };
}>(
    "/api/admin/members/:userId/alias",
    async (request, reply) => {
        const session =
            requireAdminSession(request);

        if (!session) {
            return reply
                .code(403)
                .send({
                    error:
                        "Administrator permission required",
                });
        }

        const userId =
            request.params.userId.trim();

        if (!userId) {
            return reply
                .code(400)
                .send({
                    error:
                        "Missing Discord user ID",
                });
        }

        deleteAlias(
            guildId,
            userId,
        );

        return {
            success:
                true,
            userId,
        };
    },
);

/* ==============================================================
 * Read-only voice catalogue
 * ==============================================================
 */

app.get(
    "/api/voices",
    async (request, reply) => {
        const session =
            requireGuildMemberSession(request);

        if (!session) {
            return reply
                .code(403)
                .send({
                    error:
                        "Guild membership required",
                });
        }

        try {
            const selectedVoiceId =
                getConfiguredVoiceId();

            const voices =
                Object.entries(VOICES)
                    .map(([key, voice]) => {
                        return {
                            key,
                            id:
                                voice.id,
                            name:
                                voice.name,
                            description:
                                voice.description
                                ?? null,
                            compatibleLanguages:
                                [
                                    ...voice
                                        .compatibleLanguages,
                                ],
                            selected:
                                voice.id ===
                                selectedVoiceId,
                        };
                    })
                    .sort(
                        (first, second) => {
                            if (
                                first.selected !==
                                second.selected
                            ) {
                                return first.selected
                                    ? -1
                                    : 1;
                            }

                            return first.name.localeCompare(
                                second.name,
                                "de",
                                {
                                    sensitivity:
                                        "base",
                                },
                            );
                        },
                    );

            const selectedVoice =
                selectedVoiceId
                    ? voices.find(
                        (voice) =>
                            voice.id ===
                            selectedVoiceId,
                    ) ?? null
                    : null;

            return {
                readOnly:
                    true,
                selectedVoiceId,
                selectedVoice,
                voices,
                count:
                    voices.length,
            };
        } catch (error) {
            request.log.error(
                {
                    error,
                    sqliteFile,
                    guildId,
                },
                "Read-only voice catalogue failed",
            );

            return reply
                .code(500)
                .send({
                    error:
                        "Failed to load voice catalogue",
                });
        }
    },
);

/* ==============================================================
 * Read-only guild configuration endpoint
 * ==============================================================
 */

app.get(
    "/api/config",
    async (request, reply) => {
        const session =
            requireGuildMemberSession(request);

        if (!session) {
            return reply
                .code(403)
                .send({
                    error:
                        "Guild membership required",
                });
        }

        try {
            const config =
                getStoredGuildConfig();

            const voiceId =
                typeof config?.elevenLabsVoiceId === "string"
                    ? config.elevenLabsVoiceId.trim() || null
                    : null;

            const voice =
                voiceId
                    ? Object.values(VOICES).find(
                        (entry) => entry.id === voiceId,
                    ) ?? null
                    : null;

            return {
                readOnly:
                    true,
                voiceProvider:
                    "ElevenLabs",
                voiceId,
                voiceName:
                    voice?.name ?? null,
                voiceLanguage:
                    typeof config?.voiceLanguage === "string"
                        ? config.voiceLanguage
                        : null,
                textLanguage:
                    typeof config?.textLanguage === "string"
                        ? config.textLanguage
                        : null,
            };
        } catch (error) {
            request.log.error(
                {
                    error,
                    sqliteFile,
                    guildId,
                },
                "Read-only guild configuration failed",
            );

            return reply
                .code(500)
                .send({
                    error:
                        "Failed to load guild configuration",
                });
        }
    },
);

/* ==============================================================
 * Admin TTS cache
 * ==============================================================
 */

app.get(
    "/api/admin/cache",
    async (request, reply) => {
        if (!requireAdminSession(request)) {
            return reply.code(403).send({error: "Administrator permission required"});
        }

        try {
            const {directory, entries} = await listCacheEntries();
            const totalSizeBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
            return {
                directory,
                entries,
                count: entries.length,
                totalSizeBytes,
                averageSizeBytes: entries.length > 0
                    ? Math.round(totalSizeBytes / entries.length)
                    : 0,
                oldestAt: entries.length > 0
                    ? entries.reduce((value, entry) => entry.createdAt < value ? entry.createdAt : value, entries[0]!.createdAt)
                    : null,
                newestAt: entries.length > 0
                    ? entries.reduce((value, entry) => entry.lastUsedAt > value ? entry.lastUsedAt : value, entries[0]!.lastUsedAt)
                    : null,
            };
        } catch (error) {
            request.log.error({error}, "TTS cache retrieval failed");
            return reply.code(500).send({error: "Failed to load TTS cache"});
        }
    },
);

app.delete<{Body: CacheDeleteBody}>(
    "/api/admin/cache",
    async (request, reply) => {
        const session = requireAdminSession(request);
        if (!session) {
            return reply.code(403).send({error: "Administrator permission required"});
        }

        const directory = getTTSAudioCacheDirectory();
        await mkdir(directory, {recursive: true});
        const {entries} = await listCacheEntries();
        const ids = request.body?.all === true
            ? entries.map((entry) => entry.id)
            : [...new Set(request.body?.ids ?? [])];

        if (ids.length === 0 || ids.some((id) => !isValidCacheId(id))) {
            return reply.code(400).send({error: "No valid cache IDs supplied"});
        }

        let deleted = 0;
        for (const id of ids) {
            const entry = entries.find((item) => item.id === id);
            if (!entry) {
                continue;
            }
            if (await safelyUnlink(join(directory, `${id}.${entry.extension}`))) {
                deleted += 1;
            }
            await safelyUnlink(join(directory, `${id}.json`));
        }

        writeAuditEvent({
            session,
            eventType: request.body?.all === true
                ? "dashboard.cache.cleared"
                : "dashboard.cache.deleted",
            category: "cache",
            data: {deleted, requestedIds: ids},
        });

        return {success: true, deleted};
    },
);

/* ==============================================================
 * Dashboard status and audit log
 * ==============================================================
 */

app.get(
    "/api/status",
    async (request, reply) => {
        const session =
            requireGuildMemberSession(request);

        if (!session) {
            return reply.code(403).send({error: "Guild membership required"});
        }

        const {entries} = await listCacheEntries();
        const totalSizeBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
        let memberCount: number | null = null;
        let discordReachable = false;

        try {
            const discordResponse = await fetch(
                `${DISCORD_API_URL}/guilds/${guildId}?with_counts=true`,
                {headers: {Authorization: `Bot ${botToken}`}},
            );
            discordReachable = discordResponse.ok;
            if (discordResponse.ok) {
                const guild = await discordResponse.json() as {approximate_member_count?: number};
                memberCount = guild.approximate_member_count ?? null;
            }
        } catch {
            discordReachable = false;
        }

        return {
            startedAt: new Date(dashboardStartedAt).toISOString(),
            uptimeSeconds: Math.floor((Date.now() - dashboardStartedAt) / 1000),
            discordReachable,
            memberCount,
            cache: {count: entries.length, totalSizeBytes},
            recentEvents: session.isAdmin
                ? readAuditEvents(5).map((row) => ({
                    id: row.id,
                    eventType: row.event_type,
                    category: row.category,
                    actorDisplayName: row.actor_display_name,
                    targetName: row.target_name,
                    createdAt: row.created_at,
                }))
                : [],
        };
    },
);

app.get<{Querystring: {limit?: string}}>(
    "/api/admin/events",
    async (request, reply) => {
        if (!requireAdminSession(request)) {
            return reply.code(403).send({error: "Administrator permission required"});
        }
        const parsed = Number.parseInt(request.query.limit ?? "100", 10);
        const rows = readAuditEvents(Number.isFinite(parsed) ? parsed : 100);
        return {
            events: rows.map((row) => ({
                id: row.id,
                eventType: row.event_type,
                category: row.category,
                actorUserId: row.actor_user_id,
                actorUsername: row.actor_username,
                actorDisplayName: row.actor_display_name,
                targetId: row.target_id,
                targetName: row.target_name,
                data: row.data_json ? JSON.parse(row.data_json) : null,
                createdAt: row.created_at,
            })),
        };
    },
);

app.post<{
    Params: {voiceId: string};
    Body: VoicePreviewBody;
}>(
    "/api/admin/voices/:voiceId/preview",
    async (request, reply) => {
        const session = requireAdminSession(request);
        if (!session) {
            return reply.code(403).send({error: "Administrator permission required"});
        }

        const voice = Object.values(VOICES).find((entry) => entry.id === request.params.voiceId);
        if (!voice) {
            return reply.code(404).send({error: "Voice not found"});
        }

        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) {
            return reply.code(503).send({error: "ElevenLabs API key is not configured"});
        }

        const text = request.body?.text?.trim()
            || "Hallo! So klingt diese Stimme im L-F-Ants TTS-Bot.";
        if (text.length > 300) {
            return reply.code(400).send({error: "Preview text must not exceed 300 characters"});
        }

        const language = request.body?.language?.trim() || undefined;
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_128`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_v4_turbo",
                    ...(language ? {language_code: language.split("-")[0]} : {}),
                }),
            },
        );

        if (!response.ok) {
            request.log.error({status: response.status, body: await response.text()}, "Voice preview failed");
            return reply.code(502).send({error: "Voice preview generation failed"});
        }

        writeAuditEvent({
            session,
            eventType: "dashboard.voice.previewed",
            category: "voice",
            targetId: voice.id,
            targetName: voice.name,
            data: {language: language ?? null, textLength: text.length},
        });

        const audio = Buffer.from(await response.arrayBuffer());
        return reply.type("audio/mpeg").send(audio);
    },
);

/* ==============================================================
 * Logout
 * ==============================================================
 */

app.post(
    "/auth/logout",
    async (request, reply) => {
        const sessionId =
            request.cookies[
                SESSION_COOKIE
            ];

        if (sessionId) {
            sessions.delete(
                sessionId,
            );
        }

        reply.clearCookie(
            SESSION_COOKIE,
            {
                path: "/",
            },
        );

        return {
            success:
                true,
        };
    },
);

/* ==============================================================
 * Start server
 * ==============================================================
 */

try {
    await app.listen({
        host:
            "127.0.0.1",
        port:
            3000,
    });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}
