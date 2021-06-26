import { Message, PartialMessage } from "discord.js";
import { Command, CommandTree, Handler, Plugin, RichEmbed } from "../../Handler";
import { AbstractPluginData } from "../../Structures";

interface ChannelFilterData extends AbstractPluginData {
    channels: {
            [key: string]: {
            filters: string[],
            attachments: boolean
        } | undefined
    },
    global: {
        filters: string[],
        attachments: boolean
    }
}

class ChannelFilter extends CommandTree<ChannelFilterData> {
    constructor() {
        super("channelfilter", ["filter"], "channelfilter list `<@channel|channelid>|global`\nchannelfilter add `<@channel|channelid>|global` `</regex/|attachments>`\nchannelfilter edit `<@channel|channelid>|global` <position> `</regex/>`\nchannelfilter del `<@channel|channelid>|global` <position>", "filter chat by [regex](https://regexr.com/).\nuse position in list command for edit/delete. `/regex/` must be enclosed with the / or \\` symbol.")
    }

    //TODO: threadsafe?
    invalidateGuildCache(guildid: string) {
        (<ChannelFilterPlugin>this.plugin).compiledFilters[guildid] = undefined;
    }

    buildCommandTree(): void {
        this.then("list")    
            .then("global", false, undefined, async (args, remainingContent, member, guild, channel, message, handler) => {
                const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                const filterLines = pluginData.global.filters.map((e, i) => `**${i+1}.** \`/${e}/gi\``);
                Command.paginateData(channel, handler, new RichEmbed().setTitle("ChannelFilter: list").addField("Attachments", pluginData.global.attachments ? "Blocked" : "Allowed"), filterLines);
            }).or("channel", false,  /[^\d]*?(\d+)[^\s]*/, async (args, remainingContent, member, guild, channel, message, handler) => {
                if (!guild?.channels.cache.has(<string>args.channel[1])) {
                    channel.send(new RichEmbed().setTitle("ChannelFilter: list").setDescription(`Failed to find channel <#${args.channel[1]}> / ${args.channel[1]}`));
                    return;
                }
                const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                const filterLines = pluginData.channels[<string>args.channel[1]]?.filters.map((e, i) => `**${i+1}.** /${e}/gi`) ?? [];
                Command.paginateData(channel, handler, new RichEmbed().setTitle("ChannelFilter: list").addField("Attachments", pluginData.channels[<string>args.channel[1]]?.attachments ? "Blocked" : "Allowed"), filterLines);
            }).or()
        .or("add")
            .then("global")
                .then("attachments", false, undefined, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                    pluginData.global.attachments = true;
                    await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                    channel.send(new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added attachments to the Global filter list`));
                    this.invalidateGuildCache(<string>guild?.id);
                }).or("regex", false, /(\/|`)(.*)\1/, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                    pluginData.global.filters.push(<string>args.regex[2]);
                    await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                    channel.send(new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added \`/${<string>args.regex[2]}/gi\` to the Global filter list`));
                    this.invalidateGuildCache(<string>guild?.id);
                }).or()
            .or("channel", false,  /[^\d]*?(\d+)[^\s]*/)
                .then("attachments", false, undefined, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!guild?.channels.cache.has(<string>args.channel[1])) {
                        channel.send(new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Failed to find channel <#${args.channel[1]}> / ${args.channel[1]}`));
                        return;
                    }
                    const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                    if (pluginData.channels[<string>args.channel[1]]) {
                        (<{attachments: boolean}>pluginData.channels[<string>args.channel[1]]).attachments = true;
                    } else {
                        pluginData.channels[<string>args.channel[1]] = {filters: [], attachments: true};
                    }
                    await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                    channel.send(new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added attachments to the <#${args.channel[1]}> filter list`));
                    this.invalidateGuildCache(<string>guild?.id);
                }).or("regex", false, /(\/|`)(.*)\1/, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!guild?.channels.cache.has(<string>args.channel[1])) {
                        channel.send(new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Failed to find channel <#${args.channel[1]}> / ${args.channel[1]}`));
                        return;
                    }
                    const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                    if (pluginData.channels[<string>args.channel[1]]) {
                        (<{filters: string[]}>pluginData.channels[<string>args.channel[1]]).filters.push(<string>args.regex[2]);
                    } else {
                        pluginData.channels[<string>args.channel[1]] = {filters: [<string>args.regex[2]], attachments: false};
                    }
                    channel.send(new RichEmbed().setTitle("ChannelFilter: add").setDescription(`Successfully added \`/${args.regex[2]}/gi\` to the <#${args.channel[1]}> filter list`));
                    await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                    this.invalidateGuildCache(<string>guild?.id);
                }).or()
            .or()
        .or("edit")
            .then("global")
                .then("position", false, /\d+/)
                    .then("regex", false, /(\/|`)(.*)\1/, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(<string>args.position[0]);
                    if (position < 1 || (position > pluginData.global.filters.length)) {
                        channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`))
                        return;
                    }
                    const oldValue = pluginData.global.filters[position - 1];
                    pluginData.global.filters[position - 1] = <string>args.regex[2];
                    await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                    channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully edited \`/${oldValue}/gi\` -> \`/${args.regex[2]}/gi\` in the Global filter list`));
                    this.invalidateGuildCache(<string>guild?.id);
                    }).or()
                .or()
            .or("channel", false, /[^\d]*?(\d+)[^\s]*/)
                .then("position", false, /\d+/)
                    .then("regex", false, /(\/|`)(.*)\1/, async (args, remainingContent, member, guild, channel, message, handler) => {
                        if (!guild?.channels.cache.has(<string>args.channel[1])) {
                            channel.send(new RichEmbed().setTitle("ChannelFilter: list").setDescription(`Failed to find channel <#${args.channel[1]}> / ${args.channel[1]}`));
                            return;
                        }
                        
                        const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                        const position = parseInt(<string>args.position[0]);
                        if (position < 1 || (position > <number>pluginData.channels[<string>args.channel[1]]?.filters.length ?? 0)) {
                            channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`))
                            return;
                        }
                        const oldValue = pluginData.channels[<string>args.channel[1]]?.filters[position - 1];
                        (<{filters: string[]}>pluginData.channels[<string>args.channel[1]]).filters[position - 1] = <string>args.regex[2];
                        await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                        channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully edited \`/${oldValue}/gi\` -> \`/${args.regex[2]}/gi\` in the <#${args.channel[1]}> filter list`));
                        this.invalidateGuildCache(<string>guild?.id);
                    }).or()
                .or()
            .or()
        .or("del")
            .then("global")
                .then("position", false, /\d+/, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(<string>args.position[0]);
                    if (position < 1 || (position > pluginData.global.filters.length)) {
                        channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`))
                        return;
                    }
                    const oldValue = pluginData.global.filters.splice(position - 1, 1);
                    await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                    channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully deleted \`/${oldValue}/gi\` in the Global filter list`));
                    this.invalidateGuildCache(<string>guild?.id);
                    
                }).or()
            .or("channel", false, /[^\d]*?(\d+)[^\s]*/)
                .then("position", false, /\d+/, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!guild?.channels.cache.has(<string>args.channel[1])) {
                        channel.send(new RichEmbed().setTitle("ChannelFilter: list").setDescription(`Failed to find channel <#${args.channel[1]}> / ${args.channel[1]}`));
                        return;
                    }
                        
                    const pluginData = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(<string>args.position[0]);
                    if (position < 1 || (position > <number>pluginData.channels[<string>args.channel[1]]?.filters.length ?? 0)) {
                        channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Failed to find regex in position ${position}. too big?`))
                        return;
                    }
                    const oldValue = pluginData.channels[<string>args.channel[1]]?.filters.splice(position - 1, 1);
                    await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, pluginData);
                    channel.send(new RichEmbed().setTitle("ChannelFilter: edit").setDescription(`Successfully deleted \`/${oldValue}/gi\` in the <#${args.channel[1]}> filter list`));
                    this.invalidateGuildCache(<string>guild?.id);
                            
                }).or()
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            this.selfHelp(channel, guild, handler);
        });
    }
    
}

class ChannelFilterPlugin extends Plugin<ChannelFilterData> {
    readonly compiledFilters: { [key: string]: {
        channels: { 
            [key: string]: {
                filters: RegExp[],
                attachments: boolean;
            }
        }
        global: {
            filters: RegExp[],
            attachments: boolean;
        }
    } | undefined
    } = {};
    
    constructor(name: string | undefined, description: string | undefined, defaultData: ChannelFilterData) {
        super(name, description, defaultData);

    }

    registerExtraListeners(handler: Handler) {
        handler.on("message", (msg) => this.doMessageFilter(handler, msg));
        handler.on("messageUpdate", (oldMsg, newMsg) => this.doMessageFilter(handler, newMsg))
    }

    //TODO: threadsafe?
    compileGuildFilters(guildid: string, pluginData: ChannelFilterData) {
        const compiledData: {
            channels: { 
                [key: string]: {
                    filters: RegExp[],
                    attachments: boolean;
                }
            }
            global: {
                filters: RegExp[],
                attachments: boolean;
            }
        } = {channels: {}, global: {filters: [], attachments: pluginData.global.attachments}};
        for (const filter of pluginData.global.filters) {
            compiledData.global.filters.push(new RegExp(filter, "gi"));
        }
        for (const [key, channel] of Object.entries(pluginData.channels)) {
            compiledData.channels[key] = {filters: [], attachments: <boolean>channel?.attachments};
            for (const filter of <string[]>channel?.filters) {
                compiledData.channels[key].filters.push(new RegExp(filter, "gi"));
            }
        }
        this.compiledFilters[guildid] = compiledData;
    }

    async doMessageFilter(handler: Handler, message: PartialMessage | Message) {
        if (message.guild) {
            const {enabled} = await handler.database.getGuild(message.guild.id, handler.defaultPrefix);
            if (enabled.includes(this.name)) {
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
        }
    }
}


export const plugin = new ChannelFilterPlugin("ChannelFilter", "filter message content in your server", {channels: {}, global: {filters: [], attachments: false}});
plugin.addCommand(new ChannelFilter());