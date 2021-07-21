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
const newDB = new SQLDatabase([...pluginMap.values()].map(e => e.name));

const MapPluginPerms: {[plname: string]: (oldData: any) => any} = {

}

const MapPluginAliases: {[plname: string]: (oldData: any) => any} = {

}

const MapPluginData: {[plname: string]: (oldData: any) => any} = {
    AdvancedInfo: (oldData: {}) => {
        return oldData;
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
            await newDB.setGuildPluginData(guild, newPl.name, Object.assign(deepCopy(newPl.aliases), MapPluginData[oldPl](await oldDB.getGuildPluginData(guild, oldPl, null))));
        });

        //remap MemberRank data
        //TODO:
    }
})()
