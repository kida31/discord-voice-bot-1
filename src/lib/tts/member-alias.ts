import type { KeyValueOperations } from "@lib/common/util-types";
import { Collection, Guild, User } from "discord.js";

export const ALIAS_MAX_LENGTH = 64;

interface ConfigOptions {
  persist?: Partial<KeyValueOperations<string, string>>;
}

let _db: Partial<KeyValueOperations<string, string>> = {};
let cache: Collection<string, string> = new Collection();

function memberAsKey(guildId: Guild["id"], userId: User["id"]): string {
  return `${guildId}/${userId}`;
}

export function configureAlias(options: ConfigOptions) {
  _db = options.persist ?? {};
}

export function setAlias(
  guildId: Guild["id"],
  userId: User["id"],
  alias: string,
): void {
  if (alias.length > ALIAS_MAX_LENGTH) {
    throw new Error("Alias is too long");
  }

  const key = memberAsKey(guildId, userId);

  cache.set(key, alias);
  _db.set?.(key, alias);
}

export function deleteAlias(guildId: Guild["id"], userId: User["id"]): void {
  const key = memberAsKey(guildId, userId);

  cache.delete(key);
  _db.delete?.(key);
}

export function getAlias(
  guildId: Guild["id"],
  userId: User["id"],
): string | undefined {
  const key = memberAsKey(guildId, userId);

  const value = _db.get?.(key) ?? cache.get(key);

  if (!!value) {
    cache.set(key, value);
  } else {
    cache.delete(key);
  }

  return value;
}
