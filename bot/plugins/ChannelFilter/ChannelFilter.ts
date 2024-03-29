import { Message, PartialMessage } from "discord.js";
import { Command, CommandTree, Handler, Plugin, RichEmbed, TreeTypes } from "../../Handler";
import {ChannelFilterData, CompiledChannelFilterData} from "./ChannelFiltercommon";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class ChannelFilter extends CommandTree<ChannelFilterData> {
    constructor() {
        super("channelfilter", ["filter"], "filter chat by [regex](https://regexr.com/).\nuse position in list command for edit/delete. `regex` must be enclosed with the / or \\` symbol.")
    }

    //TODO: threadsafe?
    invalidateGuildCache(guildid: string) {
        (<ChannelFilterPlugin>this.plugin).compiledFilters[guildid] = undefined;
    }

    buildCommandTree(): void {
        this.then("list")
            .then("global", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                const filterLines = pluginData.global.filters.map((e, i) => `**${i+1}.** \`/${e}/gi\``);
                Command.paginateData(channel, handler, new RichEmbed().setTitle("ChannelFilter: list").addField("Attachments", pluginData.global.attachments ? "Blocked" : "Allowed"), filterLines);
            }).or("channel", {type: TreeTypes.CHANNEL}, async (args, remainingContent, member, guild, channel, message, handler) => {
                if (!guild.channels.cache.has(<string>args.channel)) {
                    channel.send({ embeds: [new RichEmbed().setTitle("ChannelFilter: list").setDescription(`Failed to find channel <#${args.channel}> / ${args.channel}`)]});
                    return;
                }
                const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                const filterLines = pluginData.channels[<string>args.channel]?.filters.map((e, i) => `**${i+1}.** /${e}/gi`) ?? [];
                Command.paginateData(channel, handler, new RichEmbed().setTitle("ChannelFilter: list").addField("Attachments", pluginData.channels[<string>args.channel]?.attachments ? "Blocked" : "Allowed"), filterLines);
            }).or()
        .or("add")
            .then("global")
                .then("attachments", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                    pluginData.global.attachments = true;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, pluginData);
                    channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added attachments to the Global filter list`)]});
                    this.invalidateGuildCache(guild.id);
                }).or("regex", {type: /(\/|`)(.*)\1/, argFilter: (arg) => <string>arg[2]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    pluginData.global.filters.push(args.regex);
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, pluginData);
                    channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added \`/${<string>args.regex}/gi\` to the Global filter list`)]});
                    this.invalidateGuildCache(<string>guild.id);
                }).or()
            .or("channel", {type: TreeTypes.CHANNEL})
                .then("attachments", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!guild.channels.cache.has(<string>args.channel)) {
                        channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Failed to find channel <#${args.channel}> / ${args.channel}`)]});
                        return;
                    }
                    const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                    if (pluginData.channels[<string>args.channel]) {
                        (<{attachments: boolean}>pluginData.channels[<string>args.channel]).attachments = true;
                    } else {
                        pluginData.channels[<string>args.channel] = {filters: [], attachments: true};
                    }
                    await handler.database.setGuildPluginData(<string>guild.id, this.plugin.name, pluginData);
                    channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added attachments to the <#${args.channel}> filter list`)]});
                    this.invalidateGuildCache(<string>guild.id);
                }).or("regex", {type: /(\/|`)(.*)\1/, argFilter: (arg) => arg[2]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!guild.channels.cache.has(<string>args.channel)) {
                        channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Failed to find channel <#${args.channel}> / ${args.channel}`)]});
                        return;
                    }
                    const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                    if (pluginData.channels[<string>args.channel]) {
                        (<{filters: string[]}>pluginData.channels[<string>args.channel]).filters.push(<string>args.regex);
                    } else {
                        pluginData.channels[<string>args.channel] = {filters: [<string>args.regex], attachments: false};
                    }
                    channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added \`/${args.regex}/gi\` to the <#${args.channel}> filter list`)]});
                    await handler.database.setGuildPluginData(<string>guild.id, this.plugin.name, pluginData);
                    this.invalidateGuildCache(<string>guild.id);
                }).or()
            .or()
        .or("edit")
            .then("global")
                .then("position", {type: TreeTypes.INTEGER})
                    .then("regex", {type: /(\/|`)(.*)\1/, argFilter: (arg) => <string>arg[2]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(args.position);
                    if (position < 1 || (position > pluginData.global.filters.length)) {
                        channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`)]})
                        return;
                    }
                    const oldValue = pluginData.global.filters[position - 1];
                    pluginData.global.filters[position - 1] = <string>args.regex;
                    await handler.database.setGuildPluginData(<string>guild.id, this.plugin.name, pluginData);
                    channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully edited \`/${oldValue}/gi\` -> \`/${args.regex}/gi\` in the Global filter list`)]});
                    this.invalidateGuildCache(<string>guild.id);
                    }).or()
                .or()
            .or("channel", {type: TreeTypes.CHANNEL})
                .then("position", {type: TreeTypes.INTEGER})
                    .then("regex",{type: /(\/|`)(.*)\1/, argFilter: (arg) => <string>arg[2]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                        if (!guild.channels.cache.has(<string>args.channel)) {
                            channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: list").setDescription(`Failed to find channel <#${args.channel}> / ${args.channel}`)]});
                            return;
                        }
                        
                        const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                        const position = parseInt(<string>args.position);
                        if (position < 1 || (position > <number>pluginData.channels[<string>args.channel]?.filters.length ?? 0)) {
                            channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`)]})
                            return;
                        }
                        const oldValue = pluginData.channels[<string>args.channel]?.filters[position - 1];
                        (<{filters: string[]}>pluginData.channels[<string>args.channel]).filters[position - 1] = <string>args.regex;
                        await handler.database.setGuildPluginData(<string>guild.id, this.plugin.name, pluginData);
                        channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully edited \`/${oldValue}/gi\` -> \`/${args.regex}/gi\` in the <#${args.channel}> filter list`)]});
                        this.invalidateGuildCache(<string>guild.id);
                    }).or()
                .or()
            .or()
        .or("del")
            .then("global")
                .then("position", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(<string>args.position);
                    if (position < 1 || (position > pluginData.global.filters.length)) {
                        channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`)]})
                        return;
                    }
                    const oldValue = pluginData.global.filters.splice(position - 1, 1);
                    await handler.database.setGuildPluginData(<string>guild.id, this.plugin.name, pluginData);
                    channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully deleted \`/${oldValue}/gi\` in the Global filter list`)]});
                    this.invalidateGuildCache(<string>guild.id);
                    
                }).or()
            .or("channel", {type: TreeTypes.CHANNEL})
                .then("position", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!guild.channels.cache.has(<string>args.channel)) {
                        channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: list").setDescription(`Failed to find channel <#${args.channel}> / ${args.channel}`)]});
                        return;
                    }
                        
                    const pluginData = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(<string>args.position);
                    if (position < 1 || (position > <number>pluginData.channels[<string>args.channel]?.filters.length ?? 0)) {
                        channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`)]})
                        return;
                    }
                    const oldValue = pluginData.channels[<string>args.channel]?.filters.splice(position - 1, 1);
                    await handler.database.setGuildPluginData(<string>guild.id, this.plugin.name, pluginData);
                    channel.send({embeds: [new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully deleted \`/${oldValue}/gi\` in the <#${args.channel}> filter list`)]});
                    this.invalidateGuildCache(<string>guild.id);
                            
                })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            this.selfHelp(channel, guild, handler);
        });
    }
    
}

class ChannelFilterPlugin extends WebPlugin<ChannelFilterData> {
    readonly compiledFilters: { [key: string]: CompiledChannelFilterData | undefined } = {};
    
    constructor(name: string | undefined, description: string | undefined, defaultData: ChannelFilterData) {
        super(name, description, defaultData);

    }

    registerExtraListeners(handler: Handler) {
        handler.on("messageUpdate", async (oldMsg, newMsg) => {
            if (newMsg.guild) {
                const {enabled} = await handler.database.getGuild(newMsg.guild.id, handler.defaultPrefix);
                if (enabled.includes(this.name)) {
                    this.onMessage(newMsg, handler);
                }
            }
        });
    }

    //TODO: threadsafe?
    compileGuildFilters(guildid: string, pluginData: ChannelFilterData) {
        const compiledData: CompiledChannelFilterData = {channels: {}, global: {filters: [], attachments: pluginData.global.attachments}};
        for (const filter of pluginData.global.filters) {
            compiledData.global.filters.push(new RegExp(filter, "gi"));
        }
        for (const [key, channel] of Object.entries(pluginData.channels)) {
            compiledData.channels[key] = {filters: [], attachments: <boolean>channel?.attachments};
            for (const filter of channel?.filters ?? []) {
                compiledData.channels[key].filters.push(new RegExp(filter, "gi"));
            }
        }
        this.compiledFilters[guildid] = compiledData;
    }

    async onMessage(message: PartialMessage | Message, handler: Handler) {
        try {
            if (message.guild) {
                if (!this.compiledFilters[message.guild.id]) this.compileGuildFilters(message.guild.id, await handler.database.getGuildPluginData(message.guild.id, this.name, this.data));
                if (this.compiledFilters[message.guild.id]?.global.attachments || this.compiledFilters[message.guild.id]?.channels[message.channel.id]?.attachments) {
                    if (message.attachments.size > 0) {
                        message.delete();
                        return;
                    }
                }
                for (const matcher of this.compiledFilters[message.guild.id]?.global.filters.concat(this.compiledFilters[message.guild.id]?.channels[message.channel.id]?.filters ?? []) ?? []) {
                    if (message.content?.match(matcher)) {
                        message.delete();
                        return;
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}


export const plugin = new ChannelFilterPlugin("ChannelFilter", "filter message content in your server", {channels: {}, global: {filters: [], attachments: false}});
plugin.addCommand(new ChannelFilter());