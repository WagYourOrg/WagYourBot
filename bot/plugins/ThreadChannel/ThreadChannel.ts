import {Guild, Message, Snowflake, ThreadChannel} from "discord.js";
import { WebPlugin } from "../../../web/WagYourBotWeb";
import { CommandTree, Handler, RichEmbed, TreeTypes } from "../../Handler";
import {ThreadChannelData} from "./ThreadChannelcommon";

class ThreadChannelCmd extends CommandTree<ThreadChannelData> {
    
    constructor() {
        super("threadchannel", [], "Manage channels to get auto-threadded.")
    }
    
    buildCommandTree(): void {
        this.then("add", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            if (!data.channels.includes(channel.id)) {
                data.channels.push(channel.id);
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Add").setDescription(`successfully added ${channel}!`)]});
            } else {
                message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Add").setDescription(`${channel} is already in the list!`)]});
            }
        })
            .then("channel", {type: TreeTypes.CHANNEL}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const chnl = await guild.channels.fetch(args.channel);
                if (chnl) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    if (data.channels.includes(chnl.id)) {
                        message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Add").setDescription(`${chnl} is already in the list!`)]});
                    } else {
                        data.channels.push(chnl.id);
                        await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                        message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Add").setDescription(`successfully added ${chnl}!`)]});
                    }
                } else {
                    message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Add").setDescription(`Failed to find channel <#${args.channel}> / ${args.channel}`)]});
                }
            }).or()
        .or("del", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            if (data.channels.includes(channel.id)) {
                data.channels.splice(data.channels.indexOf(channel.id), 1);
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Del").setDescription(`successfully removed ${channel}!`)]});
            } else {
                message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Del").setDescription(`${channel} is not in the list!`)]});
            }
            }).then("channel", {type: TreeTypes.CHANNEL}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const chnl = await guild.channels.fetch(args.channel);
                if (chnl) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    if (data.channels.includes(chnl.id)) {
                        data.channels.splice(data.channels.indexOf(chnl.id), 1);
                        await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                        message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Del").setDescription(`successfully removed ${chnl}!`)]});
                    } else {
                        message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Del").setDescription(`${chnl} is not in the list!`)]});
                    }
                } else {
                    message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: Del").setDescription(`Failed to find channel <#${args.channel}> / ${args.channel}`)]});
                }
            }).or()
        .or("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            const embed = new RichEmbed().setTitle("ThreadChannel: List");
            if (data.channels.length > 0) {
                embed.setDescription(data.channels.map(c => `<#${c}>`).join("\n"));
            } else {
                embed.setDescription("No channels in list!");
            }
            message.reply({embeds: [embed]});
        });
    }
}

class SetThreadTitle extends CommandTree<ThreadChannelData> {
    constructor() {
        super("threadtitle", [], "set title of a thread that's parent is the user's message.", true)
    }
    
    buildCommandTree(): void {
        this.then("title", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
            if (channel.isThread()) {
                const sm = await (<ThreadChannel>channel).fetchStarterMessage();
                const owner = await (<ThreadChannel>channel).fetchOwner();
                if (owner?.id != handler.user?.id) {
                    message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: SetTitle").setDescription(`Can't set title on non-bot thread!`)]});
                    return;
                }
                if (sm == null) {
                    message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: SetTitle").setDescription(`Starting message deleted, cannot validate the author, therefore can't change title`)]});
                } else if (sm.author.id == member.id) {
                    await (<ThreadChannel>channel).setName(args.title);
                    message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: SetTitle").setDescription(`successfully set title of thread to ${args.title}!`)]});
                } else {
                    message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: SetTitle").setDescription(`you are not the author of this thread!`)]});
                }
            }
        });
    }
}

class ForceSetThreadTitle extends CommandTree<ThreadChannelData> {

    constructor() {
        super("forcethreadtitle", [], "allow mods to force a thread title change.")
    }
    
    buildCommandTree(): void {
        this.then("title", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
            if (channel.isThread()) {
                await (<ThreadChannel>channel).setName(args.title);
                message.reply({embeds: [new RichEmbed().setTitle("ThreadChannel: SetTitle").setDescription(`successfully set title of thread to ${args.title}!`)]});
            }
        });
    }

}


class ThreadChannelPlugin extends WebPlugin<ThreadChannelData> {

    registerExtraListeners(handler: Handler) {

    }


    async onMessage(message: Message, handler: Handler): Promise<void> {
        try {
            const guild: Guild | null = message.guild;
            if (guild) {
                const data = await handler.database.getGuildPluginData(guild.id, this.name, this.data);
                if (data.channels.includes(message.channel.id)) {
                    const chnl = await guild.channels.fetch(message.channel.id);
                    if (chnl) {
                        message.startThread({
                            name: message.content.length < 25 ? message.content : message.content.substring(0, 25) + "...",
                            autoArchiveDuration: 1440,
                            reason: "Auto-threaded"
                        });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}

export const plugin = new ThreadChannelPlugin("ThreadChannel", "thread every message in a channel", { channels: [] });
plugin.addCommand(new ThreadChannelCmd());
plugin.addCommand(new SetThreadTitle());
plugin.addCommand(new ForceSetThreadTitle());