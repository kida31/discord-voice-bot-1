import {Guild, User} from "discord.js";

export async function getUserVoiceChannel(guild: Guild, user: User) {
    const state = await guild.voiceStates.fetch(user);
    return state.channel;
}

export function popFirst<T>(list: T[]): [T | undefined, T[]] {
    if (list.length == 0) {
        return [undefined, []];
    }
    if (list.length == 1) {
        return [list[0]!, []];
    }
    const [item, ...rest] = list;
    return [item, rest];
}
