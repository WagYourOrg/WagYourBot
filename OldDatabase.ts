import {createClient} from 'redis';
import { PluginAliases, AbstractPluginData, PluginPerms, Database, PluginSlug } from './Structures';

export class OldDatabase implements Database {
    readonly db = createClient({db: 1});

    constructor() {

    }

    guildLength() {
        return new Promise<number>((resolve, reject) => {
            this.db.scard("Guilds", (err, reply) => {
                resolve(reply);
            });
        });
    }

    getGuilds() {
        return new Promise<string[]>((resolve, reject) => {
            this.db.smembers("Guilds", (error, reply) => {
                resolve(reply);
            });
        });
    }

    getGuild(guildID: string, prefix: string) {
        return new Promise<{prefix: string, enabled: PluginSlug[]}>((resolve, reject) => {
            this.db.sismember("Guilds", guildID, (error, reply) => {
                if (reply == 0) {
                    this.db.set(`Guilds:${guildID}`, `{ "prefix": "${prefix}", "enabled": ["Default"] }`);
                    this.db.sadd("Guilds", guildID);
                    resolve({ prefix: prefix, enabled: ["Default"] });
                } else {
                    this.db.get(`Guilds:${guildID}`, (error, reply) => {
                        if (reply != null) {
                            const data = JSON.parse(reply);
                            resolve(data);
                        } else {
                            reject();
                        }
                    });
                }
            });
        });
    }

    checkGuildPlugin(guildID: string, plugin: string) {
        return new Promise<boolean>((resolve, reject) => {
            this.db.sismember(`Guilds:${guildID}:Plugins`, plugin, (error, reply) => {
                if (reply == 0) resolve(false);
                else resolve(true);
            });
        });
    }

    getGuildPluginAliasesAndPerms<T extends PluginAliases, U extends PluginPerms>(guildID: string, plugin: string, defaultPluginAliases: T, defaultPluginPerms: U) {
        return new Promise<{aliases: T, perms: U}>((resolve, reject) => {
            this.db.sismember(`Guilds:${guildID}:Plugins`, plugin, (error, reply) => {
                if (reply == 0) {
                    this.db.hmset(`Guilds:${guildID}:Plugins:${plugin}`, "Alias", JSON.stringify(defaultPluginAliases), "Perms", JSON.stringify(defaultPluginPerms));
                    this.db.sadd(`Guilds:${guildID}:Plugins`, plugin);
                    resolve({aliases:defaultPluginAliases, perms:defaultPluginPerms});
                } else {
                    this.db.hmget(`Guilds:${guildID}:Plugins:${plugin}`, "Alias", "Perms", (err, res) => {
                        try {
                            resolve({aliases:Object.assign(defaultPluginAliases, JSON.parse(res[0])), perms:Object.assign(defaultPluginPerms, JSON.parse(res[1]))});
                        } catch(e) {
                            console.log(err);
                        }
                    });
                }
            });
        });
    }

    getGuildPluginData<T extends AbstractPluginData>(guildID: string, plugin: string, defaultData: T) {
        return new Promise<T>((resolve, reject) => {
            this.db.hget(`Guilds:${guildID}:Plugins:${plugin}`, "Data", (error, reply) => {
                if (reply) {
                    resolve(JSON.parse(reply));
                } else {
                    this.db.hset(`Guilds:${guildID}:Plugins:${plugin}`, "Data", JSON.stringify(defaultData));
                    resolve(defaultData);
                }
            });
        });
    }

    setGuildPluginData<T extends AbstractPluginData>(guildID: string, plugin: string, data: T) {
        return new Promise<void>((res, rej) => {
            this.db.hset(`Guilds:${guildID}:Plugins:${plugin}`, "Data", JSON.stringify(data));
            res();
        });
    }

    setGuildPluginAliases<T extends PluginAliases>(guildID: string, plugin: string, aliasesObject: T) {
        return new Promise<void>((res, rej) => {
            this.db.hset(`Guilds:${guildID}:Plugins:${plugin}`, "Alias", JSON.stringify(aliasesObject));
            res();
        });
    }

    setGuildPluginPerms<T extends PluginPerms>(guildID: string, plugin: string, permsObject: T) {
        return new Promise<void>((res, rej) => {
            this.db.hset(`Guilds:${guildID}:Plugins:${plugin}`, "Perms", JSON.stringify(permsObject));
            res();
        });
    }

    setGuildPrefix(guildID: string, prefix: string) {
        return new Promise<void>((res, rej) => {
            this.db.get(`Guilds:${guildID}`, (error, reply) => {
                if (reply != null) {
                    const data = JSON.parse(reply);
                    data.prefix = prefix;
                    this.db.set(`Guilds:${guildID}`, JSON.stringify(data));
                }
            });
            res();
        });
    }

    setGuildEnabled(guildID: string, plugins: string[]) {
        return new Promise<void>((res, rej) => {
            this.db.get(`Guilds:${guildID}`, (error, reply) => {
                if (reply != null) {
                    const data = JSON.parse(reply);
                    data.enabled = plugins;
                    this.db.set(`Guilds:${guildID}`, JSON.stringify(data));
                }
            });
            res();
        });
    }

    /**
     * 
     * @returns clientID[]
     */
    getClients() {
        return new Promise<string[]>((resolve, reject) => {
            this.db.smembers("Secrets", (err, reply) => {
                resolve(reply);
            });
        });
    }

    getClientToken(clientID: string) {
        return new Promise<string>((resolve, reject) => {
            this.db.sismember("Secrets", clientID, (err, reply) => {
                if (reply == 0)
                    reject("Bot Not Found");
                else {
                    this.db.hget(`Secrets:${clientID}`, "Token", (err, reply) => {
                        resolve(reply);
                    });
                }
            });
        });
    }

    getClientSecret(clientID: string) {
        return new Promise<string>((resolve, reject) => {
            this.db.sismember("Secrets", clientID, (err, reply) => {
                if (reply == 0)
                    reject("Bot Not Found");
                else {
                    this.db.hget(`Secrets:${clientID}`, "Secret", (err, reply) => {
                        resolve(reply);
                    });
                }
            });
        });
    }


    //these functions are specifically for the MemberRank plugin.

    guildMemberAddEXP(guildID: string, plugin: string, member: string, increment: number) {
        return new Promise<void>((res, rej) => {
            this.db.zadd(`Guilds:${guildID}:Plugins:${plugin}:Data:EXPList`, "INCR", increment, member);
            res();
        })
    }

    getRanks(guildID: string, plugin: string, start: number, count: number) {
        return new Promise<{member: string, score: number}[]>((resolve, reject) => {
            //ZREVRANGEBYSCORE myset +inf -inf WITHSCORES LIMIT 0 1
            this.db.zrevrangebyscore(`Guilds:${guildID}:Plugins:${plugin}:Data:EXPList`, "+inf", "-inf", "WITHSCORES", "LIMIT", start, count, (err, res) => {
                if (!res) {
                    return reject()
                };
                const result:{member: string, score: number}[] = []
                for(let i = 0; i < res.length; i += 2) {
                    result.push({member:res[i], score:parseInt(res[i+1])});
                }
                resolve(result);
            });
        });
    }

    getUserCount(guildID: string, plugin: string) {
        return new Promise<number>((resolve, reject) => {
            this.db.zcard(`Guilds:${guildID}:Plugins:${plugin}:Data:EXPList`, (err, res) => {
                resolve(res);
            });
        });
    }

    deleteUser(guildID: string, plugin: string, member: string) {
        return new Promise<void>((res, rej) => {
            this.db.zrem(`Guilds:${guildID}:Plugins:${plugin}:Data:EXPList`, member);
            this.db.hdel(`Guilds:${guildID}:Plugins:${plugin}:Data:MsgTime`, member);
            res();
        })
    }

    getGuildMemberEXP(guildID: string, plugin: string, member: string) {
        return new Promise<{rank: number | false, score: number}>((resolve, reject) => {
            this.db.zrevrank(`Guilds:${guildID}:Plugins:${plugin}:Data:EXPList`, member, (err, rank) => {
                this.db.zscore(`Guilds:${guildID}:Plugins:${plugin}:Data:EXPList`, member, (err, score) => {
                    if (score !== null && rank !== null) resolve({rank:rank, score: parseInt(score)});
                    else resolve({rank: false, score:0});
                });
            });
        });
    }

    getGuildMemberLastMessageTime(guildID: string, plugin: string, member: string) {
        return new Promise<number>((resolve, reject) => {
            this.db.hget(`Guilds:${guildID}:Plugins:${plugin}:Data:MsgTime`, member, (err, reply) => {
                if (reply) resolve(parseInt(reply));
                else resolve(0);
            });
        });
    }

    setGuildMemberLastMessageTime(guildID: string, plugin: string, member: string, time: number) {
        return new Promise<void>((res, rej) => {
            this.db.hset(`Guilds:${guildID}:Plugins:${plugin}:Data:MsgTime`, member, time.toString());
            res();
        });
    }
};