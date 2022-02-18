import {CommandTree, Handler, RichEmbed, TreeTypes} from "../../Handler";
import {Channel, Guild, GuildChannel, GuildMember, Message, PartialMessage, Role, Snowflake, TextChannel} from "discord.js";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class LogChannel extends CommandTree<ModToolsData> {
    constructor() {
        super("logchannel", [], "set the logging channel.");
    }

    buildCommandTree(): void {
        this.then("set")
            .then("channel", {type: TreeTypes.CHANNEL}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const chnl = guild.channels.resolve(args.channel);
                if (chnl && chnl.type !== "GUILD_VOICE" && chnl.type !== "GUILD_STAGE_VOICE") {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    data.logChannel = chnl.id;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send({embeds: [new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel set to ${chnl}.`)]});
                } else {
                    channel.send({embeds: [new RichEmbed().setTitle("Log Channel").setDescription(`Channel \`${args.channel}\` not found!`)]});
                }
            }).or()
        .or("disable", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.logChannel = undefined;
            await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
            channel.send({embeds: [new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel removed.`)]});
        });
    }
}

class LogMessageEdits extends CommandTree<ModToolsData> {
    constructor() {
        super("logmessageedits", [], "should the log channel include edits and removed messages");
    }

    buildCommandTree() {
        this.then("true", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.logChanges = true;
            handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, data);
            channel.send({embeds: [new RichEmbed().setTitle("LogMessageEdits").setDescription(`Now logging edits and deleted messages in <#${data.logChannel}>`)]});
        })
        .or("false", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.logChanges = false;
            handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, data);
            channel.send({embeds: [new RichEmbed().setTitle("LogMessageEdits").setDescription(`No longer logging edits and deleted messages in <#${data.logChannel}>`)]});
        })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
            data.logChanges = !data.logChanges;
            handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, data);
            channel.send({embeds: [new RichEmbed().setTitle("LogMessageEdits").setDescription(`No longer logging edits and deleted messages in <#${data.logChannel}>`)]});
        })
    }

}

class Warn extends CommandTree<ModToolsData> {
    constructor() {
        super("warn", [], "warn users of their bad deeds.");
    }

    buildCommandTree(): void {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const user = await guild.members.fetch(args.user);
            if (user) {
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                const warning = new RichEmbed().setTitle("Warn").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                await channel.send({content: user.toString(), embeds: [warning]});
                if (data.logChannel) {
                    (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                }
            } else {
                channel.send({embeds: [new RichEmbed().setTitle("Warn").setDescription(`Failed to find user for \`${args.user}\``)]});
            }
        });
    }
}

class Mute extends CommandTree<ModToolsData> {
    constructor() {
        super("mute", [], "mute a user for their bad deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("time", {type: TreeTypes.STRING})
                .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const user = await guild.members.fetch(args.user);

                    // parse time into ms
                    const date = args.time.match(/(\d+)(s|m|d|w|M|y)/);
                    if (!date) {
                        channel.send({embeds: [
                            new RichEmbed()
                                .setTitle("Mute")
                                .setDescription(`Failed to parse time: ${args.time}, please put in form like 1y\n\`/(\d+)(s|m|d|w|M|y)/\``)
                        ]})
                        return;
                    }

                    let time = parseInt(date[1]) * 1000;
                    switch (date[2]) {
                        case 'y':
                            time *= 13;
                        case 'M':
                            time *= 4;
                        case 'w':
                            time *= 7;
                        case 'd':
                            time *= 24;
                        case 'm':
                            time *= 60
                        case 's':
                            time *= 60;
                    }

                    if (user) {
                        await user.timeout(time, args.reason)
                        const warning = new RichEmbed().setTitle("Mute").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                        await channel.send({content: user.toString(), embeds: [warning]});

                        const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                        if (data.logChannel) {
                            (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                        }
                    } else {
                        channel.send({embeds: [new RichEmbed().setTitle("Mute").setDescription(`Failed to find user for \`${args.user}\``)]});
                    }
                }).or()
            .or("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);

                if (user) {
                    await user.timeout(0, args.reason)
                    const warning = new RichEmbed().setTitle("Mute").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                    await channel.send({content: user.toString(), embeds: [warning]});

                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                    }
                } else {
                    channel.send({embeds: [new RichEmbed().setTitle("Mute").setDescription(`Failed to find user for \`${args.user}\``)]});
                }
            });
    }
}

class UnMute extends CommandTree<ModToolsData> {
    constructor() {
        super("unmute", [], "unmute a user for their good deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    await user.timeout(null, args.reason);
                    const warning = new RichEmbed().setTitle("UnMute").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                    await channel.send({content: user.toString(), embeds: [warning]});
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                    }
                } else {
                    channel.send({embeds: [new RichEmbed().setTitle("UnMute").setDescription(`Failed to find user for \`${args.user}\``)]});
                }
            })
    }
}

class Kick extends CommandTree<ModToolsData> {
    constructor() {
        super("kick", [], "yeet a user from the server for their bad deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    await user.kick(args.reason);
                    const warning = new RichEmbed().setTitle("Kick").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                    await user.send({content: user.toString(), embeds: [warning]});
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                    }
                } else {
                    channel.send({embeds: [new RichEmbed().setTitle("Kick").setDescription(`Failed to find user for \`${args.user}\``)]});
                }
            })
    }
}

class Ban extends CommandTree<ModToolsData> {
    constructor() {
        super("ban", [], "permanently yeet a user from the server for their bad deeds.");
    }

    buildCommandTree(): void {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    await user.ban({reason: args.reason});
                    const warning = new RichEmbed().setTitle("Ban").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                    await user.send({content: user.toString(), embeds: [warning]});
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                    }
                } else {
                    channel.send({embeds: [new RichEmbed().setTitle("Ban").setDescription(`Failed to find user for \`${args.user}\``)]});
                }
            }).or("prune_days", {type: TreeTypes.INTEGER})
                .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const user = await guild.members.fetch(args.user);
                    if (user) {
                        const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                        await user.ban({reason: args.reason, days: parseInt(args.prune_days)});
                        const warning = new RichEmbed().setTitle("Ban").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                        await user.send({content: user.toString(), embeds: [warning]});
                        if (data.logChannel) {
                            (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                        }
                    } else {
                        channel.send({embeds: [new RichEmbed().setTitle("Ban").setDescription(`Failed to find user for \`${args.user}\``)]});
                    }
                })
    }

}

class UnBan extends CommandTree<ModToolsData> {
    constructor() {
        super("unban", [], "allow a banned user to come back for their good deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.unban(args.user, args.reason);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const warning = new RichEmbed().setTitle("UnBan").setDescription(`${user} (${user.tag})`).addField("Reason", args.reason);
                    await channel.send({embeds: [warning]});
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send({embeds: [warning.addField("By", member.toString())]});
                    }
                } else {
                    channel.send({embeds: [new RichEmbed().setTitle("UnBan").setDescription(`Failed to find user for \`${args.user}\``)]});
                }
            })
    }
}

class Prune extends CommandTree<ModToolsData> {
    constructor() {
        super("prune", [], "remove messages from a channel.");
    }

    buildCommandTree() {
        this.then("before")
            .then("message_id", {type: TreeTypes.INTEGER})
                .then("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const msgs = await channel.bulkDelete(await channel.messages.fetch({before: args.message_id, limit: parseInt(args.count)}), true);
                    channel.send({embeds: [new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`)]});
                }).or()
            .or()
        .or("after")
            .then("message_id", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const msgs = await channel.bulkDelete(await channel.messages.fetch({after: args.message_id, limit: 100}), true);
                channel.send({embeds: [new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`)]});
            })
                .then("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const msgs = await channel.bulkDelete(await channel.messages.fetch({after: args.message_id, limit: parseInt(args.count)}), true);
                    channel.send({embeds: [new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`)]});
                }).or()
            .or()
        .or("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const msgs = await channel.bulkDelete(parseInt(args.count), true);
            channel.send({embeds: [new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`)]});
        })
    }
}

class ModToolsPlugin extends WebPlugin<ModToolsData> {
    registerExtraListeners(handler: Handler) {
        handler.on("messageUpdate", (oldMsg, newMsg) => this.onMessageChange(oldMsg, newMsg, handler));
        handler.on("messageDelete", (oldMsg) => this.onMessageChange(oldMsg, null, handler));
    }


    private async onMessageChange(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage | null, handler: Handler) {
        if (oldMsg.author?.bot) return;
        if (oldMsg.guild !== null) {
            const {enabled} = await handler.database.getGuild(oldMsg.guild.id, handler.defaultPrefix);
            if (enabled.includes(this.name)) {
                const data = await handler.database.getGuildPluginData(oldMsg.guild.id, this.name, this.data);
                if (data.logChanges && data.logChannel) {
                    const channel = await oldMsg.guild.channels.resolve(data.logChannel);
                    if (channel && channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE') {
                        const embed = new RichEmbed().setTitle(newMsg ? "Message Edited" : "Message Deleted")
                            .setAuthor(<string>oldMsg.author?.tag ?? "unknown", oldMsg.author?.avatarURL({}) ?? undefined);
                            embed.addField("Channel", oldMsg.channel.toString());
                        if (oldMsg.content && oldMsg.content.length > 1000) {
                            embed.addField("From:", `\u200b${oldMsg.content.substring(0, 1000)}`, false);
                            embed.addField("\u200b", `\u200b${oldMsg.content.substring(1000)}`, false);
                        } else {
                            embed.addField("From: ", `\u200b${oldMsg.content}`, false);
                        }
                        if (newMsg) {
                            if (newMsg.content && newMsg.content.length > 1000) {
                                embed.addField("To:", `\u200b${newMsg.content.substring(0, 1000)}`, false);
                                embed.addField("\u200b", `\u200b${newMsg.content.substring(1000)}`, false);
                            } else {
                                embed.addField("To: ", `\u200b${newMsg.content}`, false);
                            }
                        } else {
                            embed.setDescription(<string>oldMsg.content);
                        }
                        const attachments = Array.from(oldMsg.attachments);
                        if (attachments.length) embed.addField("Attachments: ", attachments.map(e => `[${e[1].name}](${e[1].proxyURL}`).join("\n"));
                        (<TextChannel>channel).send({embeds: [embed]});
                    }
                }
            }
        }
    }
}

export const plugin = new ModToolsPlugin("ModTools", "Moderator commands and stuff", {muteRole: undefined, logChannel: undefined, logChanges: false});
plugin.addCommand(new LogChannel());
plugin.addCommand(new LogMessageEdits());
plugin.addCommand(new Warn());
plugin.addCommand(new Mute());
plugin.addCommand(new UnMute());
plugin.addCommand(new Kick());
plugin.addCommand(new Ban());
plugin.addCommand(new UnBan());
plugin.addCommand(new Prune());
