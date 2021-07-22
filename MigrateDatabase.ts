import { OldDatabase } from "./OldDatabase";
import { SQLDatabase } from "./Database";
import { Plugin } from "./bot/Handler";
import { plugin as advancedInfo } from "./bot/plugins/AdvancedInfo/AdvancedInfo";
import { plugin as akinator } from "./bot/plugins/Akinator/Akinator";
import { plugin as channelFilter } from "./bot/plugins/ChannelFilter/ChannelFilter";
import { plugin as defaultt } from "./bot/plugins/Default/Default";
import { plugin as reactRole } from "./bot/plugins/ReactRole/ReactRole";
import { plugin as dynamicVoiceChannels } from "./bot/plugins/DynamicVoiceChannels/DynamicVoiceChannels";
import { plugin as memberRank } from "./bot/plugins/MemberRank/MemberRank";
import { plugin as modTools } from "./bot/plugins/ModTools/ModTools";
import { plugin as messageActions } from "./bot/plugins/MessageActions/MessageActions";
import { plugin as streamingRole } from "./bot/plugins/StreamingRole/StreamingRole";
import { plugin as weather } from "./bot/plugins/Weather/Weather";
import { MessageActionData, MessageActionTypes } from "./bot/plugins/MessageActions/MessageActionscommon";


const pluginMap = new Map<string, Plugin<any>>([
    ["AdvancedInfo", advancedInfo],
    ["Akinator", akinator],
    ["ChannelFilter", channelFilter],
    ["Default", defaultt],
    ["GameRole", reactRole],
    ["LookingForPlayers", dynamicVoiceChannels],
    ["MemberRank", memberRank],
    ["ModTools", modTools],
    ["SecretPhrase", messageActions],
    ["StreamingRole", streamingRole],
    ["Weather", weather]
]);

const oldDB = new OldDatabase();
const newDB = new SQLDatabase([...pluginMap.values()].map(e => e.name), undefined, () => {
    console.log("begin");
    const MapPluginPerms: {[plname: string]: (oldData: {[key: string]: string[] | undefined }) => {[key: string]: string[]}} = {
        AdvancedInfo: (oldData) => {
            return {
                listroles: oldData.ailistroles ?? []
            };
        },
        Akinator: (oldData) => {
            return <any>oldData;
        },
        ChannelFilter: (oldData) => {
            return <any>oldData;
        },
        Default: (oldData) => {
            return <any>oldData;
        },
        GameRole: (oldData) => {
            return {
                reactrole: oldData.gamerole ?? [],
                reactrolemessage: oldData.gamerolemessage ?? []
            };
        },
        LookingForPlayers: (oldData) => {
            return {
                dvccategory: oldData.lfpcategory ?? [],
                dvcsetname: oldData.lfpsetname ?? []
            }
        },
        MemberRank: (oldData) => {
            return <any>oldData
        },
        ModTools: oldData => {
            return {
                logchannel: oldData.logchannel ?? [],
                logmessageedits: oldData.logchanges ?? [],
                muterole: oldData.muterole ?? [],
                warn: oldData.warn ?? [],
                mute: oldData.mute ?? [],
                unmute: oldData.unmute ?? [],
                kick: oldData.kick ?? [],
                ban: oldData.ban ?? [],
                unban: oldData.unban ?? [],
                prune: oldData.prune ?? []
            }
        },
        SecretPhrase: oldData => {
            return {
                messageaction: oldData.secretphrase ?? []
            }
        },
        StreamingRole: oldData => {
            return <any>oldData;
        },
        Weather: oldData => {
            return <any>oldData;
        }
    }

    const MapPluginAliases: {[plname: string]: (oldData: {[key: string]: string[] | undefined }) => {[key: string]: string[]}} = {
        AdvancedInfo: (oldData) => {
            return {
                listroles: oldData.ailistroles ?? []
            }
        },
        Akinator: (oldData) => {
            return <any>oldData;
        },
        ChannelFilter: (oldData) => {
            return <any>oldData;
        },
        Default: (oldData) => {
            return <any>oldData;
        },
        GameRole: (oldData) => {
            return {
                reactrole: oldData.gamerole ?? [],
                reactrolemessage: oldData.gamerolemessage ?? []
            };
        },
        LookingForPlayers: (oldData) => {
            return {
                dvccategory: oldData.lfpcategory ?? [],
                dvcsetname: oldData.lfpsetname ?? []
            }
        },
        MemberRank: (oldData) => {
            return <any>oldData
        },
        ModTools: oldData => {
            return {
                logchannel: oldData.logchannel ?? [],
                logmessageedits: oldData.logchanges ?? [],
                muterole: oldData.muterole ?? [],
                warn: oldData.warn ?? [],
                mute: oldData.mute ?? [],
                unmute: oldData.unmute ?? [],
                kick: oldData.kick ?? [],
                ban: oldData.ban ?? [],
                unban: oldData.unban ?? [],
                prune: oldData.prune ?? []
            }
        },
        SecretPhrase: oldData => {
            return {
                messageaction: oldData.secretphrase ?? []
            }
        },
        StreamingRole: oldData => {
            return <any>oldData;
        },
        Weather: oldData => {
            return <any>oldData;
        }
    }

    const MapPluginData: {[plname: string]: (oldData: object) => object} = {
        AdvancedInfo: (oldData) => {
            return oldData;
        },
        Akinator: (oldData) => {
            return oldData;
        },
        ChannelFilter: (oldData) => {
            const globalFilters: string[] = [];
            const channelFilters: any = {};
            let globalAttachments = false;
            for (const [key, val] of Object.entries(oldData)) {
                if (key === "all") {
                    globalFilters.push(val.regex);
                    globalAttachments = val.attachments;
                } else {
                    channelFilters[key].filters = val.regex;
                    channelFilters[key].attachments = val.attachments;
                }
            }
            return {
                channels: channelFilters,
                global: {
                    filters: globalFilters,
                    attachments: false
                }
            };
        },
        Default: (oldData) => {
            return oldData;
        },
        GameRole: (oldData) => {
            return oldData;
        },
        LookingForPlayers: (oldData) => {
            return oldData
        },
        MemberRank: (oldData) => {
            return <any>oldData
        },
        ModTools: oldData => {
            return oldData
        },
        SecretPhrase: oldData => {
            const actions: MessageActionData[] = [];
            for (const [key, val] of Object.entries((<any>oldData).roles ?? {})) {
                actions.push({
                    types: MessageActionTypes.Give_Role,
                    regex: key,
                    data: {
                        give: val
                    }
                });
            }
            return {
                actions: actions
            }
        },
        StreamingRole: oldData => {
            return {
                roleid: (<any>oldData).id
            };
        },
        Weather: oldData => {
            return {
                autoDelete: (<any>oldData).deleteMessages
            };
        }
    };

    function deepCopy(obj: any) {
        return JSON.parse(JSON.stringify(obj));
    }

//map guilds
    (async () => {
        const guilds = await oldDB.getGuilds();

        for (const guild of guilds) {
            const guildData = await oldDB.getGuild(guild, "!!");

            //remap plugin names
            guildData.enabled.map(e => pluginMap.get(e)?.name).filter(e => e);

            //save
            await newDB.setGuildEnabled(guild, guildData.enabled);
            await newDB.setGuildPrefix(guild, guildData.prefix);

            pluginMap.forEach(async (newPl, oldPl) => {
                const {aliases, perms} = await oldDB.getGuildPluginAliasesAndPerms(guild, oldPl, {}, {});

                //remap plugin data
                await newDB.setGuildPluginPerms(guild, newPl.name, Object.assign(deepCopy(newPl.perms), MapPluginPerms[oldPl](perms)));
                await newDB.setGuildPluginAliases(guild, newPl.name,  Object.assign(deepCopy(newPl.aliases), MapPluginPerms[oldPl](aliases)));
                await newDB.setGuildPluginData(guild, newPl.name, Object.assign(deepCopy(newPl.data), MapPluginData[oldPl](<any>await oldDB.getGuildPluginData(guild, oldPl, {}))));
            });

            //remap MemberRank data
            const userCount = await oldDB.getUserCount(guild, "MemberRank");
            for (let i = 0; i < userCount; i += 1000) {
                const topi = Math.min(i + 1000, userCount);
                const ranks = await oldDB.getRanks(guild, "MemberRank", i, topi - i);
                for (const rank of ranks) {
                    await newDB.guildMemberAddEXP(guild, "MemberRank", rank.member, rank.score);
                }
            }
        }
    })()

});
