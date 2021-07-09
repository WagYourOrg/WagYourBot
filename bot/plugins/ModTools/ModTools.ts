import {CommandTree, Handler, Plugin, RichEmbed, TreeTypes} from "../../Handler";
import {Guild, Role, Snowflake, TextChannel} from "discord.js";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class LogChannel extends CommandTree<ModToolsData> {
    constructor() {
        super("logchannel", [], "set the logging channel.");
    }

    buildCommandTree(): void {
        this.then("set")
            .then("channel", {type: TreeTypes.CHANNEL}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const chnl = guild.channels.resolve(args.channel);
                if (chnl && chnl.type !== "voice") {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    data.logChannel = chnl.id;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel set to ${chnl}.`));
                } else {
                    channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Channel \`${args.channel}\` not found!`));
                }
            }).or()
        .or("disable", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.logChannel = undefined;
            await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
            channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel removed.`));
        });
    }
}

class MuteRole extends CommandTree<ModToolsData> {
    constructor() {
        super("muterole", [], "set the role for the mute command.");
    }

    buildCommandTree() {
        this.then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const role = await guild.roles.fetch(args.role);
            if (role) {
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                data.logChannel = role.id;
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel set to ${role}.`));
                this.updateMuteRole(guild, role);
            } else {
                channel.send(new RichEmbed().setTitle("Mute Role").setDescription(`Role \`${args.role}\` not found!`));
            }
        })
    }

    updateMuteRole(guild: Guild, role: Role) {
        for (const chnl of guild.channels.cache.values()) {
            chnl.createOverwrite(role, {SEND_MESSAGES: false});
        }
    }
}

class Warn extends CommandTree<ModToolsData> {
    constructor() {
        super("warn", [], "warn users of their bad deeds.");
    }

    buildCommandTree(): void {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/, argFilter: arg => <string>arg[0]}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const user = await guild.members.fetch(args.user);
            if (user) {
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                const warning = new RichEmbed().setTitle("Warn").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                channel.send({content: user, embed: warning});
                if (data.logChannel) {
                    (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning);
                }
            } else {
                channel.send(new RichEmbed().setTitle("Warn").setDescription(`Failed to find user for \`${args.user}\``));
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
            .then("reason", {type: /.+/, argFilter: arg => <string>arg[0]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const role = await guild.roles.fetch(<Snowflake>data.muteRole);
                    if (data.muteRole && role) {
                        await user.roles.add(role, args.reason);
                        const warning = new RichEmbed().setTitle("Mute").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                        channel.send({content: user, embed: warning});
                        if (data.logChannel) {
                            (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning);
                        }
                    } else {
                        channel.send(new RichEmbed().setTitle("Mute").setDescription(`Failed to mute user as \`muterole\` isn't set.`));
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("Mute").setDescription(`Failed to find user for \`${args.user}\``));
                }
            })
    }
}

class UnMute extends CommandTree<ModToolsData> {
    constructor() {
        super("unmute", [], "unmute a user for their good deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/, argFilter: arg => <string>arg[0]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const role = await guild.roles.fetch(<Snowflake>data.muteRole);
                    if (data.muteRole && role) {
                        await user.roles.remove(role, args.reason);
                        const warning = new RichEmbed().setTitle("UnMute").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                        channel.send({content: user, embed: warning});
                        if (data.logChannel) {
                            (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning);
                        }
                    } else {
                        channel.send(new RichEmbed().setTitle("UnMute").setDescription(`Failed to unmute user as \`muterole\` isn't set.`));
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("UnMute").setDescription(`Failed to find user for \`${args.user}\``));
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
                    channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
                }).or()
            .or()
        .or("after")
            .then("message_id", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const msgs = await channel.bulkDelete(await channel.messages.fetch({after: args.message_id, limit: 100}), true);
                channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
            })
                .then("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const msgs = await channel.bulkDelete(await channel.messages.fetch({after: args.message_id, limit: parseInt(args.count)}), true);
                    channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
                }).or()
            .or()
        .or("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const msgs = await channel.bulkDelete(parseInt(args.count), true);
            channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
        })
    }
}


class ModToolsPlugin extends WebPlugin<ModToolsData> {
    registerExtraListeners(handler: Handler) {

    }
}

export const plugin = new ModToolsPlugin("ModTools", "Moderator commands and stuff", {muteRole: undefined, logChannel: undefined, logChanges: false});
plugin.addCommand(new LogChannel());
plugin.addCommand(new MuteRole());
plugin.addCommand(new Warn());
plugin.addCommand(new Mute());
plugin.addCommand(new UnMute());
plugin.addCommand(new Prune());