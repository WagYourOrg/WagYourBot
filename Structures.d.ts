import { Snowflake } from "discord.js";

export interface Database {
    //TOKEN
    getClients(): Promise<Snowflake[]>;
    getClientToken(clientID: Snowflake): Promise<string>;
    getClientSecret(clientID: Snowflake): Promise<string>;

    //MAIN    
    guildLength(): Promise<number>;
    
    /**
     * @deprecated
     */
    getGuilds(): Promise<Snowflake[]>;
    getGuild(guildID: Snowflake, defaultPrefix: string): Promise<{prefix: string, enabled: PluginSlug[]}>;
    checkGuildPlugin(guildID: string, plugin: PluginSlug): Promise<boolean>;
    getGuildPluginAliasesAndPerms<T extends PluginAliases, U extends PluginPerms>(guildID: Snowflake, plugin: PluginSlug, defaultPluginAliases: T, defaultPluginPerms: U): Promise<{aliases: T, perms: U}>;
    getGuildPluginData<T extends AbstractPluginData>(guildID: Snowflake, plugin: PluginSlug, defaultData: T): Promise<T>;
    setGuildPluginData<T extends AbstractPluginData>(guildID: Snowflake, plugin: PluginSlug, data: T): Promise<void>;
    setGuildPluginAliases<T extends PluginAliases>(guildID: Snowflake, plugin: PluginSlug, aliases: T): Promise<void>;
    setGuildPluginPerms<T extends PluginPerms>(guildID: Snowflake, plugin: PluginSlug, perms: T): Promise<void>;
    setGuildPrefix(guildID: Snowflake, prefix: string): Promise<void>;
    setGuildEnabled(guildID: Snowflake, plugins: PluginSlug[]): Promise<void>;

    //MEMBER_RANK
    guildMemberAddEXP(guildID: Snowflake, plugin: PluginSlug, member: Snowflake, increment: number): Promise<void>;
    getRanks(guildID: Snowflake, plugin: PluginSlug, start: number, count: number): Promise<{member: Snowflake, score: number}[]>;
    getUserCount(guildID: Snowflake, plugin: PluginSlug): Promise<number>;
    deleteUser(guildID: Snowflake, plugin: PluginSlug, member: Snowflake): Promise<void>;
    getGuildMemberEXP(guildID: Snowflake, plugin: PluginSlug, member: Snowflake): Promise<{rank: number | false, score: number}>;
    getGuildMemberLastMessageTime(guildID: Snowflake, plugin: PluginSlug, member: Snowflake): Promise<number>;
    setGuildMemberLastMessageTime(guildID: Snowflake, plugin: PluginSlug, member: Snowflake, time: number): Promise<void>;
}

export interface PluginAliases {
     [key: string]: string[] | undefined;
}
export interface PluginPerms {
    [key: string]: string[] | undefined;
}
export interface AbstractPluginData {}

export type PluginSlug = string;