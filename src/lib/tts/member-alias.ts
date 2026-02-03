import type { KeyValueOperations } from "@lib/common/util-types";
import { Collection, type GuildMember } from "discord.js";

interface ConfigOptions {
  persist?: Partial<KeyValueOperations<string, string>>;
}

let _db: Partial<KeyValueOperations<string, string>> = {};
let cache: Collection<string, string> = new Collection();

function memberAsKey(member: GuildMember): string {
  return `${member.guild.id}/${member.id}`;
}

export function configureAlias(options: ConfigOptions) {
  _db = options.persist ?? {};
}

export function setAlias(member: GuildMember, alias: string): void {
  const key = memberAsKey(member);

  cache.set(key, alias);
  _db.set?.(key, alias);
}

export function deleteAlias(member: GuildMember): void {
  const key = memberAsKey(member);

  cache.delete(key);
  _db.delete?.(key);
}

export function getAlias(member: GuildMember): string | undefined {
  const key = memberAsKey(member);

  const value = _db.get?.(key) ?? cache.get(key);

  if (!!value) {
    cache.set(key, value);
  } else {
    cache.delete(key);
  }

  return value;
}
